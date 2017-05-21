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
      return rpcookie(onepiece + 'grad_stud_qry?v_iden_kind=1&v_code=8&v_pass=N&v_type=1')
    })
    .then($ => {
      let rows = []
      let head = []
      $('th').each((i, th) => {
        head.push(cheerio(th).text())
      })
      // debugJson(head)
      $('tr').each((i, tr) => {
        let row = []
        cheerio(tr).find('td').each((i, td) => {
          row.push(_.trim(cheerio(td).text()))
        })
        row = _.zipObject(head, row)
        delete row['序號']
        _.each(['學年', '學期', '畢業學分', '成績', '承認別'], key => {
          if (/^\d+$/.test(row[key])) {
            row[key] = _.parseInt(row[key])
          } else if (key === '成績') {
            if (row[key] === 'P') {
              row[key] = 100
            } else {
              row[key] = 0
            }
          }
          if (!_.isSafeInteger(row[key])) {
            throw new Error(row[key] + ' can not be parse as int.')
          }
        })
        rows.push(row)
      })
      debugJson(rows)
      return rows
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
