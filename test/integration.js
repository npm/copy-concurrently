'use strict'
var fs = require('fs')
var path = require('path')
var test = require('tap').test
var copy = require('../copy.js')
var Tacks = require('tacks')
var loadFromDir = require('tacks/load-from-dir')
var areTheSame = require('tacks/tap.js').areTheSame
var File = Tacks.File
var Symlink = Tacks.Symlink
var Dir = Tacks.Dir
var isWindows = require('../is-windows.js')

var basedir = path.join(__dirname, path.basename(__filename, '.js'))

function testdir (dir) {
  return path.join(basedir, dir)
}

var testContent = {
  test: 'this'
}

var fixture = new Tacks(Dir({
  'test-dir': Dir({
    subdir: Dir({
      'file1.json': File(testContent),
      'file2.json': File(testContent)
    }),
    subdir2: Dir({
      'linky': Symlink(path.join('..', 'subdir')),
      'file2.json': File(testContent),
      subsub: Dir({
        'aaaa': Symlink('bbbb'),
        'bbbb': Dir(),
        'zzzz.json': File(testContent)
      })
    })
  }),
  'test-dir-symlink': Symlink('test-dir'),
  'test-file.json': File(testContent),
  'test-symlink.json': Symlink('test-file.json'),
  'existing': File('')
}))

function readFile (file) {
  return JSON.parse(fs.readFileSync(testdir(file)))
}
function readSymlink (file) {
  return path.relative(basedir, path.resolve(basedir, fs.readlinkSync(testdir(file))))
}

var testDirContent

test('setup', function (t) {
  fixture.remove(basedir)
  fixture.create(basedir)
  testDirContent = loadFromDir(testdir('test-dir'))
  t.done()
})

test('copy', function (t) {
  t.plan(5 + (isWindows ? 0 : 2))

  copy(testdir('test-file.json'), testdir('copy-test-file.json')).then(function () {
    t.isDeeply(readFile('copy-test-file.json'), testContent, 'copied file content')
    return copy(testdir('test-file.json'), testdir('existing')).catch(function (err) {
      t.is(err.code, 'EEXIST', "won't overwrite files")
    })
  }).catch(t.fail)
  if (!isWindows) {
    // skip file symlink test on windows, 'cause as a rule, it's not supported
    copy(testdir('test-symlink.json'), testdir('copy-test-symlink.json')).then(function () {
      t.is(readSymlink('copy-test-symlink.json'), 'test-file.json', 'copied symlink')
      return copy(testdir('test-symlink.json'), testdir('existing')).catch(function (err) {
        t.is(err.code, 'EEXIST', "won't overwrite symlinks")
      })
    }).catch(t.fail)
  }
  copy(testdir('test-dir-symlink'), testdir('copy-test-dir-symlink')).then(function () {
    t.is(readSymlink('copy-test-dir-symlink'), 'test-dir', 'copied dir symlink')
  }).catch(t.fail)
  copy(testdir('test-dir'), testdir('copy-test-dir')).then(function () {
    var copied = loadFromDir(testdir('copy-test-dir'))
    areTheSame(t, copied, testDirContent, 'copied test directory')
    return copy(testdir('test-dir'), testdir('existing')).catch(function (err) {
      t.is(err && err.code, 'EEXIST', "won't overwrite dirs")
    })
  }).catch(t.fail)
})

test('cleanup', function (t) {
  fixture.remove(basedir)
  t.done()
})
