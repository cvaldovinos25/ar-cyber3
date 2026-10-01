// ============================================================
// SALCOTÍN DICE (sin motores externos)
//
// Cuatro Salcotines flotan alrededor de la persona (adelante, derecha,
// atrás e izquierda), cada uno con un aro de color. En cada ronda se
// iluminan en una secuencia; mientras se muestra, la esquina inferior
// derecha indica "Atrapa a este Salcotín" con su color. Después la
// persona gira el celular y los toca en el mismo orden. Cada ronda
// suma un paso. Un error termina el juego.
//
// Usa solo lo que trae el navegador (cámara + sensores de giro) y
// three.js alojado en este mismo repositorio.
// En computador se mira alrededor arrastrando con el mouse.
// ============================================================

// ---------- Ajustes del juego ----------
const CONFIG = {
  GOAL: 5,                   // rondas superadas para el premio estándar (5 a 7)
  BIG_GOAL: 8,               // rondas superadas para el premio mayor (8 o más)
  MAX_ROUNDS: 20,            // tope: si alguien llega aquí, gana y termina

  // Velocidad de la secuencia (del inicio a la ronda 10; después queda fija)
  SHOW_ON_MS: [800, 450],    // cuánto se ilumina cada Salcotín
  SHOW_GAP_MS: [350, 180],   // pausa entre uno y otro
  FIRST_ROUND_LENGTH: 1,     // largo de la secuencia en la ronda 1

  // Ayuda en el turno del jugador: true = la esquina muestra cuál toca ahora
  // (modo fácil). false = solo se muestra mientras se ve la secuencia.
  SHOW_TARGET_DURING_TURN: false,

  // Dónde están los Salcotines
  DISTANCE: 2.6,             // metros
  HEIGHT: -0.35,             // metros respecto a los ojos
  PLANE_HEIGHT: 1.05,        // alto de cada Salcotín (m); el ancho se calcula solo

  TAP_TOLERANCE_PX: 30,      // un toque cerca de un Salcotín también cuenta
  SOUND: true,               // tonos al iluminarse y al tocar

  CAMERA_FOV: 60,
  SMOOTHING: 0.35,           // 0 a 1: más bajo = movimiento más suave

  // Récord compartido entre todos los jugadores (Google Sheets + Apps Script).
  // Es la misma planilla que la Caza relámpago: este juego guarda sus partidas
  // en su propia hoja ("Salcotín dice") y tiene su propio récord.
  // Si la planilla no responde, el juego funciona igual, sin mostrar el récord.
  RECORD_URL: 'https://script.google.com/macros/s/AKfycbzzpm71QdnOGZ9dQs6hrLSvIZdhA0kY-liu1M-qBMYX9yXfmc477a40CDJWM11PLA/exec',
  GAME_ID: 'dice',           // identifica a este juego en la planilla
  RECORD_TIMEOUT_MS: 6000,
}

// Los cuatro Salcotines: color del aro, nombre y tono (Hz)
const COLORS = [
  { name: 'fucsia',   hex: '#ff2bd6', tone: 329.6 },
  { name: 'celeste',  hex: '#3fc3ff', tone: 440.0 },
  { name: 'amarillo', hex: '#ffd84d', tone: 554.4 },
  { name: 'verde',    hex: '#3ddc84', tone: 659.3 },
]

const ASSETS = {
  salcotin: 'assets/1.png',
  confetti: ['assets/amarillo.png', 'assets/celeste.png', 'assets/rosa.png'],
}

// Premios según las rondas superadas (se revisan en orden)
const PRIZES = [
  {
    minScore: CONFIG.BIG_GOAL,               // 8 o más
    kicker: '¡PREMIO MAYOR!',
    image: 'assets/2.png',
    message: '¡Increíble memoria! Toma un pantallazo y canjea tu premio mayor.',
  },
  {
    minScore: CONFIG.GOAL,                   // 5 a 7
    kicker: '¡Lo lograste!',
    image: 'assets/2.png',
    message: '¡Toma un pantallazo y canjea tu premio!',
  },
]

const TEXTS = {
  watch: 'Mira la secuencia',
  yourTurn: '¡Tu turno!',
  turnProgress: (i, n) => `Atrápalos en orden: ${i} de ${n}`,
  roundDone: '¡Bien!',
  wrong: '¡Ups!',
  kickerLose: '¡Fin del juego!',
  units: (n) => n === 1 ? 'ronda superada' : 'rondas superadas',
  noPrize: (missing) => missing === 1
    ? '¡Casi! Te faltó 1 ronda para ganar un premio.'
    : `¡Casi! Te faltaron ${missing} rondas para ganar un premio.`,
  toBigPrize: (missing) => missing === 1
    ? 'Con 1 ronda más habrías ganado el premio mayor.'
    : `Con ${missing} rondas más habrías ganado el premio mayor.`,
  recordLoading: 'Buscando el récord de jugadores...',
  record: (n) => `Récord de jugadores: ${n} ${n === 1 ? 'ronda' : 'rondas'}`,
  youHaveRecord: '¡Tienes el récord! Por ahora...',
  tiedRecord: (n) => `¡Igualaste el récord de jugadores! (${n})`,
}

const randRange = (min, max) => Math.random() * (max - min) + min
const toRad = (deg) => (deg * Math.PI) / 180
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const $ = (id) => document.getElementById(id)

// ---------- Estado general ----------
let renderer, scene, camera
let textures = {}
let salcotines = []          // { group, body, halo, color, index, litUntil }
let sequence = []            // índices de COLORS
let inputIndex = 0
let round = 0                // ronda actual (1, 2, 3...)
let state = 'idle'           // idle | showing | input | over
let dragMode = false
let started = false

// ============================================================
// 1. Orientación del celular -> rotación de la cámara 3D
// ============================================================
const orientation = { alpha: null, beta: 0, gamma: 0 }
const targetQuat = new THREE.Quaternion()
const zAxis = new THREE.Vector3(0, 0, 1)
const tmpEuler = new THREE.Euler()
const tmpQuat = new THREE.Quaternion()
const toFront = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))

function onDeviceOrientation(event) {
  if (event.alpha === null) return
  orientation.alpha = event.alpha
  orientation.beta = event.beta
  orientation.gamma = event.gamma
}

function screenAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle
  return window.orientation || 0
}

function updateTargetFromSensors() {
  tmpEuler.set(toRad(orientation.beta), toRad(orientation.alpha), -toRad(orientation.gamma), 'YXZ')
  targetQuat.setFromEuler(tmpEuler)
  targetQuat.multiply(toFront)
  targetQuat.multiply(tmpQuat.setFromAxisAngle(zAxis, -toRad(screenAngle())))
}

let yaw = 0
let pitch = 0
function updateTargetFromDrag() {
  tmpEuler.set(pitch, yaw, 0, 'YXZ')
  targetQuat.setFromEuler(tmpEuler)
}

function forwardAngle() {
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  return Math.atan2(f.x, f.z)
}

// ============================================================
// 2. Permisos, cámara, imágenes y sonido
// ============================================================
async function requestMotionPermission() {
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    const result = await DeviceOrientationEvent.requestPermission()
    if (result !== 'granted') throw new Error('MOTION_DENIED')
  }
  window.addEventListener('deviceorientation', onDeviceOrientation)
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('NO_CAMERA_API')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  })
  const video = $('camera-feed')
  video.srcObject = stream
  await video.play()
}

function loadTexture(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (tex) => {
      tex.encoding = THREE.sRGBEncoding
      tex.anisotropy = 4
      resolve(tex)
    }, undefined, () => reject(new Error('No se pudo cargar ' + url)))
  })
}

async function loadAllTextures() {
  const loader = new THREE.TextureLoader()
  const [salcotin, ...confetti] = await Promise.all([
    loadTexture(loader, ASSETS.salcotin),
    ...ASSETS.confetti.map((u) => loadTexture(loader, u)),
  ])
  textures = { salcotin, confetti }
}

// tonos simples con Web Audio (no necesita archivos de sonido)
let audio = null
function initAudio() {
  if (!CONFIG.SOUND) return
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume()
  } catch (e) { audio = null }
}

function playTone(freq, ms, type) {
  if (!audio) return
  try {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = type || 'sine'
    osc.frequency.value = freq
    const t = audio.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + ms / 1000 + 0.05)
  } catch (e) { /* sin sonido: no pasa nada */ }
}

function friendlyError(error) {
  const name = error && (error.name || error.message)
  if (!window.isSecureContext) return 'La página tiene que abrirse con https:// para poder usar la cámara.'
  if (name === 'MOTION_DENIED') return 'Se negó el permiso de movimiento. Cierra esta pestaña, vuelve a abrir el link y acepta el permiso.'
  if (name === 'NO_CAMERA_API') return 'Este navegador no permite usar la cámara. Abre el link en Safari (iPhone) o Chrome (Android), no dentro de Instagram o WhatsApp.'
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Se negó el permiso de cámara. Actívalo en los ajustes del navegador para este sitio y recarga la página.'
  if (name === 'NotReadableError') return 'La cámara está siendo usada por otra app. Ciérrala y recarga la página.'
  return 'Ocurrió un error inesperado: ' + (error && error.message ? error.message : name)
}

function showError(error) {
  console.error(error)
  $('loading-screen').classList.add('hidden')
  $('start-screen').classList.add('hidden')
  $('error-message').textContent = friendlyError(error)
  $('error-screen').classList.remove('hidden')
}

// ============================================================
// 3. Escena: cuatro Salcotines con aro de color
// ============================================================
// aro de color dibujado en un canvas (brillo suave + borde)
function makeHaloTexture(hex) {
  const size = 256
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')
  const mid = size / 2
  const glow = g.createRadialGradient(mid, mid, size * 0.18, mid, mid, size * 0.5)
  glow.addColorStop(0, 'rgba(255,255,255,0)')
  glow.addColorStop(0.62, hex + '55')
  glow.addColorStop(0.8, hex + 'cc')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, size, size)
  g.lineWidth = size * 0.045
  g.strokeStyle = hex
  g.beginPath()
  g.arc(mid, mid, size * 0.4, 0, Math.PI * 2)
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.encoding = THREE.sRGBEncoding
  return tex
}

function setupScene() {
  renderer = new THREE.WebGLRenderer({ canvas: $('scene'), alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x000000, 0)
  renderer.outputEncoding = THREE.sRGBEncoding

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(CONFIG.CAMERA_FOV, window.innerWidth / window.innerHeight, 0.05, 100)

  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200))
}

// se ubican relativos a hacia dónde mira la persona al empezar
function placeSalcotines() {
  const img = textures.salcotin.image
  const h = CONFIG.PLANE_HEIGHT
  const w = h * (img.width / img.height)
  const bodyGeom = new THREE.PlaneGeometry(w, h)
  const haloSize = Math.max(w, h) * 1.35
  const haloGeom = new THREE.PlaneGeometry(haloSize, haloSize)
  const front = forwardAngle()

  COLORS.forEach((color, i) => {
    const group = new THREE.Group()
    const angle = front - (i * Math.PI) / 2      // adelante, derecha, atrás, izquierda
    group.position.set(Math.sin(angle) * CONFIG.DISTANCE, CONFIG.HEIGHT, Math.cos(angle) * CONFIG.DISTANCE)

    const halo = new THREE.Mesh(haloGeom, new THREE.MeshBasicMaterial({
      map: makeHaloTexture(color.hex), transparent: true, depthWrite: false, opacity: 0.45,
    }))
    halo.position.z = -0.02
    group.add(halo)

    const body = new THREE.Mesh(bodyGeom, new THREE.MeshBasicMaterial({
      map: textures.salcotin, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.02,
    }))
    group.add(body)

    scene.add(group)
    salcotines.push({ group, body, halo, color, index: i, litUntil: 0, litStart: 0, wobble: Math.random() * 10 })
  })
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// ilumina un Salcotín: aro brillante, salto y tono
function lightUp(index, ms) {
  const s = salcotines[index]
  const now = performance.now()
  s.litStart = now
  s.litUntil = now + ms
  playTone(s.color.tone, Math.min(ms, 600))
}

const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)

function updateSalcotines(now) {
  for (const s of salcotines) {
    s.group.lookAt(camera.position.x, s.group.position.y, camera.position.z)
    const lit = now < s.litUntil
    if (lit) {
      const t = clamp((now - s.litStart) / 220, 0, 1)
      const k = easeOutBack(t)
      s.halo.material.opacity = 1
      s.halo.scale.setScalar(1 + 0.18 * k)
      s.body.position.y = 0.18 * Math.sin(Math.PI * clamp((now - s.litStart) / 380, 0, 1))
      s.body.scale.set(1 + 0.06 * k, 1 + 0.06 * k, 1)
    } else {
      // reposo: balanceo suave
      const wiggle = Math.sin(now / 1000 * 2.4 + s.wobble)
      s.halo.material.opacity = 0.45
      s.halo.scale.setScalar(1)
      s.body.position.y = 0.03 * wiggle
      s.body.scale.set(1, 1, 1)
    }
  }
}

// ============================================================
// 4. Confeti
// ============================================================
function createConfettiBurst(texture, position, gravity, count) {
  const sprites = []
  const img = texture.image
  const aspect = img.width / img.height
  for (let i = 0; i < count; i++) {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    material.rotation = Math.random() * Math.PI * 2
    const sprite = new THREE.Sprite(material)
    const size = randRange(0.05, 0.09)
    sprite.scale.set(size * aspect, size, 1)
    sprite.position.copy(position)
    const dir = new THREE.Vector3(randRange(-1, 1), randRange(-0.3, 1), randRange(-1, 1)).normalize()
    sprite.userData.v = dir.multiplyScalar(randRange(1, 2)).add(new THREE.Vector3(0, 1, 0))
    sprite.userData.spin = randRange(-6, 6)
    scene.add(sprite)
    sprites.push(sprite)
  }
  const start = performance.now()
  let last = start
  const duration = 1100
  function step(now) {
    const t = (now - start) / duration
    const dt = (now - last) / 1000
    last = now
    if (t >= 1) { sprites.forEach((s) => { scene.remove(s); s.material.dispose() }); return }
    for (const s of sprites) {
      s.userData.v.y -= gravity * 9.8 * dt
      s.position.addScaledVector(s.userData.v, dt)
      s.material.rotation += s.userData.spin * dt
      s.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function confettiAt(position, count) {
  const gravities = [0.6, 0.5, 0.2]
  textures.confetti.forEach((tex, i) => createConfettiBurst(tex, position, gravities[i] || 0.4, count))
}

// ============================================================
// 5. Textos en pantalla
// ============================================================
function setStatus(text, turn) {
  const el = $('status')
  el.textContent = text
  el.classList.toggle('turn', !!turn)
}

// esquina inferior derecha: muestra el Salcotín del color indicado
function showTarget(index) {
  const card = $('target-card')
  if (index === null) { card.classList.add('hidden'); return }
  card.style.setProperty('--ring', COLORS[index].hex)
  card.classList.remove('hidden', 'pop')
  void card.offsetWidth // reinicia la animación
  card.classList.add('pop')
}

let centerTimer = null
function showCenterText(text, small, ms) {
  const el = $('center-text')
  clearTimeout(centerTimer)
  el.textContent = text
  el.classList.toggle('small', !!small)
  el.classList.remove('hidden', 'pop')
  void el.offsetWidth
  el.classList.add('pop')
  if (ms) centerTimer = setTimeout(() => el.classList.add('hidden'), ms)
}

// ============================================================
// 6. Flujo del juego
// ============================================================
function speed() {
  const t = clamp((round - 1) / 9, 0, 1)
  return { on: lerp(CONFIG.SHOW_ON_MS[0], CONFIG.SHOW_ON_MS[1], t), gap: lerp(CONFIG.SHOW_GAP_MS[0], CONFIG.SHOW_GAP_MS[1], t) }
}

function randomColorIndex() {
  // evita repetir el mismo tres veces seguidas, que se ve como un error
  let i
  do { i = Math.floor(Math.random() * COLORS.length) }
  while (sequence.length >= 2 && sequence[sequence.length - 1] === i && sequence[sequence.length - 2] === i)
  return i
}

async function startGame() {
  sequence = []
  for (let i = 0; i < CONFIG.FIRST_ROUND_LENGTH - 1; i++) sequence.push(randomColorIndex())
  round = 0
  $('hud').classList.remove('hidden')
  for (const txt of ['3', '2', '1']) { showCenterText(txt, false, 0); await wait(700) }
  $('center-text').classList.add('hidden')
  nextRound()
}

async function nextRound() {
  round += 1
  if (round > CONFIG.MAX_ROUNDS) return endGame(true)
  sequence.push(randomColorIndex())
  $('round').textContent = round
  await showSequence()
}

async function showSequence() {
  state = 'showing'
  setStatus(TEXTS.watch, false)
  await wait(650)
  const { on, gap } = speed()
  for (const idx of sequence) {
    if (state !== 'showing') return
    showTarget(idx)
    lightUp(idx, on)
    await wait(on)
    showTarget(null)
    await wait(gap)
  }
  startInput()
}

function startInput() {
  state = 'input'
  inputIndex = 0
  showCenterText(TEXTS.yourTurn, true, 800)
  setStatus(TEXTS.turnProgress(1, sequence.length), true)
  if (CONFIG.SHOW_TARGET_DURING_TURN) showTarget(sequence[0])
}

function onPick(index) {
  if (state !== 'input') return
  const s = salcotines[index]
  lightUp(index, 350)

  if (index !== sequence[inputIndex]) return wrongPick()

  inputIndex += 1
  if (navigator.vibrate) navigator.vibrate(25)
  if (inputIndex < sequence.length) {
    setStatus(TEXTS.turnProgress(inputIndex + 1, sequence.length), true)
    if (CONFIG.SHOW_TARGET_DURING_TURN) showTarget(sequence[inputIndex])
    return
  }

  // ronda completa
  state = 'showing'
  showTarget(null)
  confettiAt(s.group.position.clone(), 12)
  showCenterText(TEXTS.roundDone, true, 900)
  setTimeout(() => {
    playTone(784, 120); setTimeout(() => playTone(1046.5, 180), 120)
  }, 150)
  setTimeout(nextRound, 1200)
}

function wrongPick() {
  state = 'over'
  showTarget(null)
  playTone(140, 450, 'sawtooth')
  if (navigator.vibrate) navigator.vibrate([80, 60, 120])
  document.body.classList.add('wrong')
  setTimeout(() => document.body.classList.remove('wrong'), 500)
  showCenterText(TEXTS.wrong, false, 1000)
  // se muestra cuál era el correcto
  setTimeout(() => lightUp(sequence[inputIndex], 900), 400)
  setTimeout(() => endGame(false), 1600)
}

function endGame(maxed) {
  state = 'over'
  const passed = maxed ? CONFIG.MAX_ROUNDS : round - 1   // rondas superadas
  showResults(passed)
}

// ============================================================
// 7. Toques y arrastre
// ============================================================
const tapRay = new THREE.Raycaster()
const tapNdc = new THREE.Vector2()

function screenPos(obj) {
  const p = new THREE.Vector3()
  obj.getWorldPosition(p)
  const behind = p.clone().applyMatrix4(camera.matrixWorldInverse).z > 0
  p.project(camera)
  return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight, behind }
}

function tryTap(clientX, clientY) {
  if (state !== 'input') return
  tapNdc.x = (clientX / window.innerWidth) * 2 - 1
  tapNdc.y = -(clientY / window.innerHeight) * 2 + 1
  tapRay.setFromCamera(tapNdc, camera)
  const hits = tapRay.intersectObjects(salcotines.map((s) => s.body), false)
  if (hits.length) return onPick(salcotines.find((s) => s.body === hits[0].object).index)

  let best = null
  let bestD = CONFIG.TAP_TOLERANCE_PX
  for (const s of salcotines) {
    const p = screenPos(s.body)
    if (p.behind) continue
    const d = Math.hypot(p.x - clientX, p.y - clientY)
    if (d <= bestD) { best = s; bestD = d }
  }
  if (best) onPick(best.index)
}

let pointerStart = null
function setupInput() {
  const canvas = $('scene')
  canvas.addEventListener('pointerdown', (e) => {
    pointerStart = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY }
    if (!dragMode) tryTap(e.clientX, e.clientY)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!pointerStart || !dragMode) return
    yaw += (e.clientX - pointerStart.lastX) * 0.005
    pitch = clamp(pitch + (e.clientY - pointerStart.lastY) * 0.005, -1.3, 1.3)
    pointerStart.lastX = e.clientX
    pointerStart.lastY = e.clientY
  })
  canvas.addEventListener('pointerup', (e) => {
    if (!pointerStart) return
    const moved = Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y)
    pointerStart = null
    if (dragMode && moved < 12) tryTap(e.clientX, e.clientY)
  })
  canvas.addEventListener('pointercancel', () => { pointerStart = null })
}

// ============================================================
// 8. Resultado, récord y código de la partida
// ============================================================
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'   // sin 0, O, 1, I ni L
const CODE_LENGTH = 6

function generatePlayCode() {
  const values = new Uint32Array(CODE_LENGTH)
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(values)
  else for (let i = 0; i < CODE_LENGTH; i++) values[i] = Math.floor(Math.random() * 4294967296)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[values[i] % CODE_CHARS.length]
  return code.slice(0, 3) + '-' + code.slice(3)       // por ejemplo: K7P-Q4M
}

async function submitScore(points, code) {
  if (!CONFIG.RECORD_URL) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONFIG.RECORD_TIMEOUT_MS)
  try {
    const url = CONFIG.RECORD_URL + '?action=submit&score=' + encodeURIComponent(points) +
      '&code=' + encodeURIComponent(code) + '&game=' + encodeURIComponent(CONFIG.GAME_ID)
    const res = await fetch(url, { signal: controller.signal })
    const data = await res.json()
    return data && data.ok ? data : null
  } catch (e) {
    console.warn('No se pudo guardar el puntaje en la planilla', e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function showRecord(points, code) {
  const el = $('result-record')
  if (!CONFIG.RECORD_URL) { el.textContent = ''; return }
  el.textContent = TEXTS.recordLoading
  const data = await submitScore(points, code)
  if (!data) { el.textContent = ''; return }
  const prev = data.previousRecord
  if (prev === null || prev === undefined || points > prev) el.textContent = TEXTS.youHaveRecord
  else if (points === prev && points > 0) el.textContent = TEXTS.tiedRecord(prev)
  else el.textContent = TEXTS.record(data.record)
}

function showResults(passed) {
  const prize = PRIZES.find((p) => passed >= p.minScore)
  $('result-score').textContent = passed
  $('result-unit').textContent = TEXTS.units(passed)
  $('result-kicker').textContent = prize ? prize.kicker : TEXTS.kickerLose

  const img = $('result-prize')
  if (prize) {
    img.onerror = () => img.classList.add('hidden')
    img.src = prize.image
    img.classList.remove('hidden')
    let message = prize.message
    const better = PRIZES.filter((p) => p.minScore > passed)
    if (better.length) message += ' ' + TEXTS.toBigPrize(Math.min(...better.map((p) => p.minScore)) - passed)
    $('result-message').textContent = message
  } else {
    img.classList.add('hidden')
    const lowest = Math.min(...PRIZES.map((p) => p.minScore))
    $('result-message').textContent = TEXTS.noPrize(lowest - passed)
  }

  const code = generatePlayCode()
  $('result-code-value').textContent = code
  showRecord(passed, code)

  $('hud').classList.add('hidden')
  $('target-card').classList.add('hidden')
  $('results-screen').classList.remove('hidden')
}

// ============================================================
// 9. Bucle de dibujo
// ============================================================
function loop(now) {
  if (dragMode) updateTargetFromDrag()
  else if (orientation.alpha !== null) updateTargetFromSensors()
  camera.quaternion.slerp(targetQuat, CONFIG.SMOOTHING)
  camera.updateMatrixWorld()
  updateSalcotines(now)
  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}

// ============================================================
// 10. Arranque
// ============================================================
async function launchExperience() {
  if (started) return
  started = true
  initAudio()   // el sonido tiene que activarse con el toque del botón
  $('start-screen').classList.add('hidden')
  $('loading-screen').classList.remove('hidden')

  try {
    await requestMotionPermission() // primero, mientras el toque sigue vigente en iOS
  } catch (error) {
    showError(error)
    return
  }

  try {
    await Promise.all([
      startCamera().catch((error) => {
        if (error && (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')) {
          console.warn('Sin cámara disponible, sigo sin video de fondo.')
          return
        }
        throw error
      }),
      loadAllTextures(),
    ])
  } catch (error) {
    showError(error)
    return
  }

  setupScene()
  setupInput()
  requestAnimationFrame(loop)

  // esperar los primeros datos de los sensores
  setTimeout(() => {
    if (orientation.alpha === null) dragMode = true
    if (dragMode) updateTargetFromDrag()
    else updateTargetFromSensors()
    camera.quaternion.copy(targetQuat)
    camera.updateMatrixWorld()
    placeSalcotines()
    $('loading-screen').classList.add('hidden')
    startGame()
  }, 900)
}

$('rules-goal').textContent = CONFIG.GOAL
$('rules-big').textContent = CONFIG.BIG_GOAL
$('start-button').addEventListener('click', launchExperience)
