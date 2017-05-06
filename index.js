const promise = require('bluebird')
const fs = promise.promisifyAll(require('fs'))
const cheerio = require('cheerio')
const Enities = require('html-entities').XmlEntities
const enities = new Enities()

const request = require('request')
request.debug = true
const j = request.jar()

const rp = require('request-promise')
const rpcookie = rp.defaults({
  transform: cheerio.load,
  jar: j,
  simple: false,
  followRedirect: true
})

var nchu = require('./nchu.json')
try {
  fs.writeFileSync('./debug.html', '')
} catch (e) {}

rpcookie('https://nchu-am.nchu.edu.tw/nidp/idff/sso?id=63&sid=0&option=credential&sid=0')
  .then($ => {
    debug($('form'))

    return rpcookie.post('https://nchu-am.nchu.edu.tw/nidp/idff/sso?id=63&sid=0&option=credential&sid=0', {form: {
      'Ecom_User_ID': nchu['id'],
      'Ecom_Password': nchu['pw'],
      'option': 'credential',
      'target': 'https://portal.nchu.edu.tw/portal'
    }})
  })
  .then($ => {
    debug($)
    return rpcookie('https://nchu-am.nchu.edu.tw/nidp/app?sid=0')
  })
  .then($ => {
    debug($)
    return rpcookie.post('https://portal.nchu.edu.tw/portal/j_spring_security_check', {form: {
      'j_username': nchu['id'],
      'j_password': nchu['pw']
    }})
  })
  .then($ => {
    debug($)
    // console.log($)
    return rpcookie('https://portal.nchu.edu.tw/portal/')
  })
  .then($ => {
    debug($('#profile'))
    return rpcookie('https://onepiece2.nchu.edu.tw/cofsys/plsql/acad_home')
  })
  .then($ => {
    debug($)
    return rpcookie.post('https://onepiece2.nchu.edu.tw/cofsys/plsql/ACAD_PASSCHK', {form: {
      v_emp: nchu['id'],
      v_pwd: nchu['pw'],
      v_lang: 'chn'
    }})
  }).then($ => {
    debug($)
    return rpcookie('https://onepiece2.nchu.edu.tw/cofsys/plsql/grad_stud_qry?v_iden_kind=1&v_code=13&v_pass=N&v_type=1')
  })
  .then($ => {
    debug($)
  })
  .catch((err) => {
    console.log(err)
  })

function debug ($) {
  fs.appendFileAsync('debug.html', enities.decode($.html()))
}
