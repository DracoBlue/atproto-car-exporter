import { CarReader } from '@ipld/car'
import { decode } from '@ipld/dag-cbor'
import { zipSync } from 'fflate'

// ── ATproto MST traversal ──────────────────────────────────────────────────

async function readBlocks(reader) {
  const blocks = new Map()
  for await (const { cid, bytes } of reader.blocks()) {
    blocks.set(cid.toString(), bytes)
  }
  return blocks
}

function traverseMst(cid, blocks, records, prevKey) {
  const raw = blocks.get(cid.toString())
  if (!raw) return prevKey

  const node = decode(raw)
  let key = prevKey

  if (node.l != null) {
    key = traverseMst(node.l, blocks, records, key)
  }

  for (const entry of (node.e ?? [])) {
    const suffix = new TextDecoder().decode(entry.k)
    key = key.slice(0, entry.p) + suffix

    const recordRaw = blocks.get(entry.v.toString())
    if (recordRaw) {
      records[key] = decode(recordRaw)
    }

    if (entry.t != null) {
      key = traverseMst(entry.t, blocks, records, key)
    }
  }

  return key
}

function getRecordDate(record) {
  const value = record?.updatedAt ?? record?.createdAt
  if (typeof value !== 'string') return null
  const ts = new Date(value)
  return isNaN(ts.getTime()) ? null : ts
}

async function carToZip(bytes, onProgress) {
  onProgress('Reading CAR file…')
  const reader = await CarReader.fromBytes(bytes)
  const [root] = await reader.getRoots()

  onProgress('Loading blocks…')
  const blocks = await readBlocks(reader)
  onProgress(`Loaded ${blocks.size} blocks. Traversing repo…`)

  const commitRaw = blocks.get(root.toString())
  if (!commitRaw) throw new Error('Root block not found')
  const commit = decode(commitRaw)

  const flatRecords = {}
  traverseMst(commit.data, blocks, flatRecords, '')

  const keys = Object.keys(flatRecords)
  onProgress(`Found ${keys.length} records. Building ZIP…`)

  const now = new Date()
  const zipFiles = {}

  for (const path of keys) {
    const slash = path.indexOf('/')
    const collection = slash >= 0 ? path.slice(0, slash) : path
    const rkey = slash >= 0 ? path.slice(slash + 1) : path
    const record = flatRecords[path]
    const mtime = getRecordDate(record) ?? now
    const filename = `${collection}/${rkey}.json`
    zipFiles[filename] = [new TextEncoder().encode(JSON.stringify(record, null, 2)), { mtime }]
  }

  const zipped = zipSync(zipFiles, { level: 6 })
  onProgress(`Done! ${keys.length} records exported.`)
  return zipped
}

// ── UI ────────────────────────────────────────────────────────────────────

function setup() {
  const input = document.getElementById('file-input')
  const dropzone = document.getElementById('dropzone')
  const status = document.getElementById('status')
  const btn = document.getElementById('export-btn')

  function showStatus(msg) {
    status.textContent = msg
  }

  async function processFile(file) {
    if (!file || !file.name.endsWith('.car')) {
      showStatus('Please select a .car file.')
      return
    }
    btn.disabled = true
    showStatus('Reading file…')
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      const zip = await carToZip(bytes, showStatus)

      const blob = new Blob([zip], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name.replace(/\.car$/i, '') + '_export.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      showStatus('Error: ' + (err?.message ?? String(err)))
      console.error(err)
    } finally {
      btn.disabled = false
    }
  }

  input.addEventListener('change', () => {
    if (input.files[0]) processFile(input.files[0])
  })

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.classList.add('drag-over')
  })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'))
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  })

  btn.addEventListener('click', () => input.click())
}

document.addEventListener('DOMContentLoaded', setup)
