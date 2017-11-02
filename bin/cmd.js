#!/usr/bin/env node

var fs = require('fs')
var path = require('path')
var args = require('minimist')(process.argv)
var hstring = require('hyper-string')
var level = require('level')
var diff = require('diff').diffWordsWithSpace
var swarm = require('discovery-swarm')
var indexer = require('hyperlog-index')
var memdb = require('memdb')
var randombytes = require('randombytes')

if (args.h || args.help) {
  return exit(0)
}

if (args._.length !== 4) {
  return exit(1)
}

var subcommand = args._[2]
var file = args._[3]

function getDb (file, existsOkay) {
  if (!fs.existsSync(file)) {
    return exit(1)
  }
  var filename = '.hpad-' + path.basename(file)
  var dirname = path.dirname(file)
  var dbpath = path.join(dirname, filename)
  if (!existsOkay && fs.existsSync(dbpath)) {
    console.error('ERROR:', file, 'is already backed by a hyperpad.')
    return process.exit(1)
  }
  return hstring(level(dbpath))
}

if (subcommand === 'init') {
  var str = getDb(file)
  var txt = fs.readFileSync(file, 'utf8')
  var docId = randombytes(12).toString('hex')
  str.log.append({id:docId})
  str.insert(null, txt, function (err) {
    if (err) throw err
    console.log('['+docId+'] created hyperpad for', file)
  })
} else if (subcommand === 'update') {
  var str = getDb(file, true)
  var txt = fs.readFileSync(file, 'utf8')
  str.chars(function (err, chars) {
    if (err) throw err
    var htxt = chars.map(function (ch) { return ch.chr }).join('')
    var changes = diff(htxt, txt)

    var pos = 0
    function processChange () {
      if (!changes.length) {
        var idx = createIndex(str)
        idx.ready(function () {
          console.log('['+idx.id+'] updated', file)
        })
        return
      }
      var change = changes.shift()
//      console.log('change', change, pos)
      if (!change.added && !change.removed) {
        pos += change.value.length
        process.nextTick(processChange)
      } else if (change.added) {
//        console.log('inserting', change.value, 'at', chars[pos].pos)
        var at = pos > 0 ? chars[pos-1].pos : null
        str.insert(at, change.value, processChange)
      } else if (change.removed) {
//        console.log('deleting', change.value.length, 'at', chars[pos].pos)
        str.delete(chars[pos].pos, change.value.length, processChange)
        pos += change.value.length
      } else {
        throw new Error('this shouldn\'t happen')
      }
    }
    processChange()
  })
} else if (subcommand === 'sync') {
  var str = getDb(file, true)
  var idx = createIndex(str)
  idx.ready(function () {
    console.log('['+idx.id+'] syncing', file)
    var sw = swarm()
    sw.listen(1292 + Math.floor(Math.random() * 3000))
    console.log('Joining swarm', idx.id, '\n')
    console.log('Press CTRL+C to terminate synchronization..')
    sw.join(idx.id)

    var seen = {}
    sw.on('connection', function (socket, info) {
      var peerId = info.host + '|' + info.port
      console.log('found peer', peerId)
      if (seen[peerId]) {
        console.log('skipping already-seen peer', peerId)
        return
      }
      seen[peerId] = true
      console.log('replicating to peer', peerId + '..')
      replicate(str.log.replicate(), socket, function (err) {
        console.log('replicated to peer', peerId + '!')

        // update file
        idx.ready(function () {
          str.text(function (err, txt) {
            fs.writeFileSync(file, txt, 'utf8')
            console.log('file updated')
          })
        })
      })
    })
  })
} else if (subcommand === 'print') {
  var str = getDb(file, true)
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

function replicate (r1, r2, cb) {
//  r1.on('data', console.log)
//  r2.on('data', console.log)
  r1.once('end', done)
  r2.once('end', done)
  r1.once('error', done)
  r2.once('error', done)

  r1.pipe(r2).pipe(r1)

  var pending = 2
  function done (err) {
    if (err) {
      pending = Infinity
      return cb(err)
    }
    if (--pending) {
      return
    }
    cb()
  }
}

function createIndex (string) {
  var idx = indexer({
    log: string.log,
    db: memdb(),
    map: map
  })

  function map (row, next) {
    if (row.value.id) {
      idx.id = row.value.id
    }
    next()
  }

  return idx
}
