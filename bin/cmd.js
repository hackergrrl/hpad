#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var args = require('minimist')(process.argv)
var hstring = require('hyper-string')
var level = require('level')

if (args.h || args.help) {
  return exit(0)
}

if (args._.length !== 4) {
  return exit(1)
}

var subcommand = args._[2]
var file = args._[3]

if (subcommand === 'init') {
  if (!fs.existsSync(file)) {
    return exit(1)
  }
  var filename = '.hpad-' + path.basename(file)
  var dirname = path.dirname(file)
  var dbpath = path.join(dirname, filename)
  if (fs.existsSync(dbpath)) {
    console.error('ERROR:', file, 'is already backed by a hyperpad.')
    return process.exit(1)
  }
  var str = hstring(level(dbpath))
  var txt = fs.readFileSync(file, 'utf8')
  str.insert(null, txt, function (err) {
    if (err) throw err
    console.log('Now backing', file, 'with a hyperpad.')
  })
} else if (subcommand === 'update') {
} else if (subcommand === 'sync') {
} else {
  exit(1)
}

function exit (code) {
  fs.createReadStream(path.join(__dirname, 'USAGE'))
    .pipe(process.stdout)
  process.stdout.on('end', function () {
    process.exit(code)
  })
}

