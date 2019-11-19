function main(params) {
  var math = require('mathjs');
  var two = math.round(math.sqrt(3))

  console.log("two is " + two)
  return { "msg": "two is " + two }
}

exports.main = main
