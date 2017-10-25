#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var args = require('minimist')(process.argv)

if (args.h || args.help) {
  return exit(0)
}

if (args._.length !== 4) {
  return exit(1)
}

var subcommand = args._[2]
var file = args._[3]

if (subcommand === 'init') {
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
