const promise = require('bluebird')
const fs = promise.promisifyAll(require('fs'))
const cheerio = require('cheerio')
const Enities = require('html-entities').XmlEntities
const enities = new Enities()
const _ = require('lodash')
const request = require('request')
const j = request.jar()
const rp = require('request-promise')
const envDev = require.main === module

var getCredit = exports.getCredit = (id, pw) => {
  try {
    if (envDev) {
      fs.writeFileSync('./debug.html', '')
    }
  } catch (e) {}

  const nchuam = 'https://nchu-am.nchu.edu.tw/nidp/'
  const portal = 'https://portal.nchu.edu.tw/portal/'
  const onepiece = 'https://onepiece2.nchu.edu.tw/cofsys/plsql/'
  const rpcookie = rp.defaults({
    transform: cheerio.load,
    jar: j,
    simple: false,
    followRedirect: true
  })

  let courseList = {
    'name': 'name',
    'studentId': id,
    'list': []
  }

  return rpcookie(nchuam + 'idff/sso?id=63&sid=0&option=credential&sid=0')
    .then($ => {
      // debug($('form'))

      return rpcookie.post(nchuam + 'idff/sso?id=63&sid=0&option=credential&sid=0', {form: {
          'Ecom_User_ID': nchu['id'],
          'Ecom_Password': nchu['pw'],
          'option': 'credential',
          'target': 'https://portal.nchu.edu.tw/portal'
      }})
    })
    .then($ => {
      // debug($)
      return rpcookie(nchuam + 'app?sid=0')
    })
    .then($ => {
      // debug($)
      return rpcookie.post(portal + 'j_spring_security_check', {form: {
          'j_username': nchu['id'],
          'j_password': nchu['pw']
      }})
    })
    .then($ => {
      // debug($)
      // console.log($)
      return rpcookie(portal)
    })
    .then($ => {
      // debug($('#profile'))
      return rpcookie(onepiece + 'acad_home')
    })
    .then($ => {
      // debug($)
      return rpcookie.post(onepiece + 'ACAD_PASSCHK', {form: {
          v_emp: nchu['id'],
          v_pwd: nchu['pw'],
          v_lang: 'chn'
      }})
    })
    .then($ => {
      return rpcookie(onepiece + 'grad_stud_summary')
    })
    .then($ => {
      let name = cheerio($('font')[3]).text()
      courseList['name'] = name
    })
    .then($ => {
      // debug($)
      return rpcookie(onepiece + 'Stu_ScoreQry_All')
    })
    .then($ => {
      let rows = []
      let head = ['選課號碼', '課程別', '科目名稱', '課程分類', '開課系所', '學分', '成績', '等第']
      let years = []

      _.each($('font[color="000000"][face="標楷體"][size="4"]'), (font) => {
        let title = cheerio(font).text()
        if (title.indexOf('學年度') !== -1) {
          title = title.split(' ')

          years.push({
            '學年': title[0],
            '學期': title[5]
          })
        }
      })

      let year = 0
      _.each($('table[border="1"]'), (table) => {
        let headerTitle = cheerio(table).find('th font').text()

        if (headerTitle.indexOf('選課號碼') !== -1) {
          _.each(cheerio(table).find('tr'), (tr) => {
            let row = []
            cheerio(tr).find('td').each((i, td) => {
              let info = cheerio(td).html()

              if (info.indexOf('<br>') !== -1) {
                info = info.split('<br>')
                // console.log(info)
                info = info[0]
                info = cheerio.load(info).text()
                row.push(_.trim(info))
              }else {
                row.push(_.trim(cheerio(td).text()))
              }
            })

            row = _.zipObject(head, row)
            row = _.assignIn(row, years[year])
            row['畢業學分'] = _.parseInt(row['學分'])
            row['課程名稱'] = row['科目名稱']

            delete row['等第']
            delete row['學分']
            delete row['科目名稱']

            _.each(['學年', '學期', '畢業學分', '成績'], (key) => {
              if (/^\d+$/.test(row[key])) {
                row[key] = _.parseInt(row[key])
              } else if (key === '成績') {
                if (row[key] === 'P') {
                  row[key] = 100
                }
                else if (row[key] === '抵') {
                  row[key] = 100
                } else {
                  row[key] = 0
                }
              }
            })

            console.log(row)
          })
          year++
        }
      })
    })
}

function debug ($) {
  if (!envDev) {
    return
  }
  fs.appendFileAsync('debug.html', enities.decode($.html()))
}

function debugJson (json) {
  if (!envDev) {
    return
  }
  if (!_.isString(json)) {
    json = JSON.stringify(json, null, 2)
  }
  fs.appendFileAsync('debug.html', json)
}

if (envDev) {
  // main function for test
  var nchu = require('./nchu.json')

  getCredit(nchu.id, nchu.pw).then(debugJson).catch(e => {
    console.log(e)
  })
}
