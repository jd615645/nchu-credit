const promise = require('bluebird')
const fs = promise.promisifyAll(require('fs'))
const cheerio = require('cheerio')
const Enities = require('html-entities').XmlEntities
const enities = new Enities()
const _ = require('lodash')
const request = require('request')
const j = request.jar()
const rp = require('request-promise')

const http = require('http')
const Router = require('router')
const bodyParser = require('body-parser')

var router = new Router()

var server = http.createServer((req, res) => {
  router(req, res, (err) => {
    if (!err) {
      res.writeHead(404)
    } else {
      // Handle errors
      console.log(err.message, err.stack)
      res.writeHead(400)
    }
    res.end('RESTful API Server is running!')
  })
})

server.listen(3001, () => {
  console.log('Listening on port 3001')
})
router.use(bodyParser.urlencoded())

router.post('/', getData)

function getData (req, res) {
  // console.log(req.body)
  let postData = req.body
  let schoolId = postData.id
  let schoolPw = postData.pw

  res.writeHead(201, {
    'Content-Type': 'text/plain'
  })

  try {
    getCredit(schoolId, schoolPw).then(data => {
      res.end(JSON.stringify(data))
    })
  } catch(e) {
    console.log(e)
    res.end('error')
  }
}

function getCredit (schoolId, schoolPw) {
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
    'studentName': '',
    'studentDept': '',
    'courseList': []
  }

  return rpcookie(nchuam + 'idff/sso?id=63&sid=0&option=credential&sid=0')
    .then($ => {
      return rpcookie.post(nchuam + 'idff/sso?id=63&sid=0&option=credential&sid=0', {form: {
          'Ecom_User_ID': schoolId,
          'Ecom_Password': schoolPw,
          'option': 'credential',
          'target': 'https://portal.nchu.edu.tw/portal'
      }})
    })
    .then($ => {
      return rpcookie(nchuam + 'app?sid=0')
    })
    .then($ => {
      return rpcookie.post(portal + 'j_spring_security_check', {form: {
          'j_username': schoolId,
          'j_password': schoolPw
      }})
    })
    .then($ => {
      return rpcookie(portal)
    })
    .then($ => {
      return rpcookie(onepiece + 'acad_home')
    })
    .then($ => {
      return rpcookie.post(onepiece + 'ACAD_PASSCHK', {form: {
          v_emp: schoolId,
          v_pwd: schoolPw,
          v_lang: 'chn'
      }})
    })
    .then($ => {
      return rpcookie(onepiece + 'grad_stud_summary')
    })
    .then($ => {
      let name = cheerio($('font')[3]).text()
      let dept = cheerio($('font')[6]).text().split(' ')[0]
      courseList['studentName'] = name
      courseList['studentDept'] = dept
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

            courseList['courseList'].push(row)
          })
          year++
        }
      })
      return courseList
    })
}
