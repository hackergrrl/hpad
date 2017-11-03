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

if (subcommand === 'init') {
  var str = getDb(file)
  var txt = fs.readFileSync(file, 'utf8')
  var docId = randombytes(12).toString('hex')
  str.log.append({id:docId, filename:file})
  str.insert(null, txt, function (err) {
    if (err) throw err
    console.log('['+docId+'] created hyperpad for', file)
  })
} else if (subcommand === 'update') {
  var str = getDb(file, true)
  var txt = fs.readFileSync(file, 'utf8')

  update(str, txt, function (err) {
    if (err) throw err
    str.id(function (err, id) {
      console.log('['+id+'] updated', file)
    })
  })
} else if (subcommand === 'sync') {
  var str = getDb(file, true)

  // do an automatic 'update' op before sync'ing
  update(str, fs.readFileSync(file, 'utf8'), function () {
    // sync!
    str.id(function (err, id) {
      console.log('['+id+'] joining swarm for', file)
      var sw = swarm()
      var port = 1292 + Math.floor(Math.random() * 3000)
      sw.listen(port)
      console.log('listening on', port)
      console.log('Press CTRL+C to terminate synchronization..')
      sw.join(id)

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
          str.id(function (err, id) {
            str.text(function (err, txt) {
              fs.writeFileSync(file, txt, 'utf8')
              console.log('file updated')
            })
          })
        })
      })
    })
  })
} else if (subcommand === 'cat') {
  var str = getDb(file, true)
  str.text(function (err, txt) {
    process.stdout.write(txt)
  })
} else if (subcommand === 'clone') {
  var key = file
  var memstr = hstring(memdb())
  var idx = createIndex(memstr)
  console.log('['+key+'] joining swarm for', key)
  var sw = swarm()
  var port = 1292 + Math.floor(Math.random() * 3000)
  sw.listen(port)
  console.log('listening on', port)
  console.log('Press CTRL+C to terminate cloning..')
  sw.join(key)

  sw.once('connection', function (socket, info) {
    var peerId = info.host + '|' + info.port
    console.log('found peer', peerId)
    console.log('replicating to peer', peerId + '..')
    replicate(memstr.log.replicate(), socket, function (err) {
      console.log('replicated to peer', peerId + '!')

      // update file
      idx.ready(function () {
        memstr.text(function (err, txt) {
          console.log('idx', idx)
          if (fs.exists(idx.filename)) {
            console.log('ERROR:', idx.filename, 'already exists; cannot clone.')
            return process.exit(1)
          }
          fs.writeFileSync(idx.filename, txt, 'utf8')
          console.log('file written')
          var str = hstring(level('.hpad-' + idx.filename))
          replicate(memstr.log.replicate(), str.log.replicate(), function (err) {
            console.log('db written')
          })
        })
      })
    })
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
  var str = hstring(level(dbpath))
  var idx = createIndex(str)

  str.id = function (cb) {
    idx.ready(function () {
      cb(null, idx.id)
    })
  }
  
  return str
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
    db: string.log.db,
    map: map
  })

  string.log.db.get('hpad-idx-id', function (err, docId) {
    if (err && !err.notFound) throw err
    idx.id = docId
    string.log.db.get('hpad-idx-filename', function (err, docName) {
      if (err && !err.notFound) throw err
      idx.filename = docName
    })
  })

  function map (row, next) {
    if (idx.id && idx.filename) return next()
    
    if (row.value.id) {
      idx.id = row.value.id
      idx.filename = row.value.filename
      string.log.db.put('hpad-idx-id', row.value.id, function (err) {
        if (err) return next(err)
        string.log.db.put('hpad-idx-filename', row.value.filename, next)
      })
    } else {
      next()
    }
  }

  return idx
}

  function update (str, txt, cb) {
    str.chars(function (err, chars) {
      if (err) throw err
      var htxt = chars.map(function (ch) { return ch.chr }).join('')
      var changes = diff(htxt, txt)

      var pos = 0
      function processChange () {
        if (!changes.length) {
          return cb()
        }
        var change = changes.shift()
        console.log('change', change, pos)
        if (!change.added && !change.removed) {
          pos += change.value.length
          process.nextTick(processChange)
        } else if (change.added) {
          var at = pos > 0 ? chars[pos-1].pos : null
          console.log('inserting', change.value, 'at', at)
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
  }
