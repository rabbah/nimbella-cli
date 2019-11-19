function main(params) {
  var math = require('mathjs');
  var three = math.round(math.e)

  console.log("three is " + three)
  return { "msg": "three is " + three }
}

exports.main = main
