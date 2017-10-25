#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var args = require('minimist')(process.argv)
var hstring = require('hyper-string')
var level = require('level')
var diff = require('diff').diffWordsWithSpace

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
  if (!fs.existsSync(file)) {
    return exit(1)
  }
  var filename = '.hpad-' + path.basename(file)
  var dirname = path.dirname(file)
  var dbpath = path.join(dirname, filename)
  if (!fs.existsSync(dbpath)) {
    console.error('ERROR:', file, 'isnt backed by a hyperpad.')
    return process.exit(1)
  }
  var str = hstring(level(dbpath))
  var txt = fs.readFileSync(file, 'utf8')
  str.chars(function (err, chars) {
    if (err) throw err
    var htxt = chars.map(function (ch) { return ch.chr }).join('')
    var changes = diff(htxt, txt)

    var pos = 0
    function processChange () {
      if (!changes.length) {
        console.error('done')
        return
      }
      var change = changes.shift()
      console.log('change', change, pos)
      if (!change.added && !change.removed) {
        pos += change.value.length
        process.nextTick(processChange)
      } else if (change.added) {
        console.log('inserting', change.value, 'at', chars[pos].pos)
        var at = pos > 0 ? chars[pos-1].pos : null
        str.insert(at, change.value, processChange)
      } else if (change.removed) {
        console.log('deleting', change.value.length, 'at', chars[pos].pos)
        str.delete(chars[pos].pos, change.value.length, processChange)
        pos += change.value.length
      } else {
        throw new Error('this shouldn\'t happen')
      }
    }
    processChange()
  })
} else if (subcommand === 'sync') {
} else if (subcommand === 'print') {
  if (!fs.existsSync(file)) {
    return exit(1)
  }
  var filename = '.hpad-' + path.basename(file)
  var dirname = path.dirname(file)
  var dbpath = path.join(dirname, filename)
  if (!fs.existsSync(dbpath)) {
    console.error('ERROR:', file, 'isnt backed by a hyperpad.')
    return process.exit(1)
  }
  var str = hstring(level(dbpath))
  str.text(function (err, txt) {
    console.log(txt)
  })
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

