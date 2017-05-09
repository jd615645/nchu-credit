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

var server = http.createServer(function (req, res) {
  router(req, res, function (err) {
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

server.listen(3000, function () {
  console.log('Listening on port 3000')
})
router.use(bodyParser.text())

router.post('/', getData)

function getData (req, res) {
  let postData = JSON.parse(req.body)
  let schoolId = postData.id
  let schoolPw = postData.pw

  res.writeHead(201, {
    'Content-Type': 'text/plain'
  })

  getCredit(schoolId, schoolPw).then(data => {
    res.end(JSON.stringify(data))
  })
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
      return rpcookie(onepiece + 'grad_stud_qry?v_iden_kind=1&v_code=13&v_pass=N&v_type=1')
    })
    .then($ => {
      let rows = []
      let head = []
      $('th').each((i, th) => {
        head.push(cheerio(th).text())
      })
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
      return rows
    })
}
