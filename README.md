# Salcotín dice

Juego de memoria en realidad aumentada para el celular. Cuatro Salcotines, cada uno con un aro de color, flotan alrededor de la persona sobre la imagen de la cámara. En cada ronda se iluminan en una secuencia y hay que atraparlos en el mismo orden, girando el celular para encontrarlos. Cada ronda la secuencia crece en un paso.

Funciona directo en el navegador, sin instalar ninguna app, y no depende de motores ni servicios externos: todo el código, las imágenes y la librería 3D viven en este repositorio y se publican con GitHub Pages. El récord compartido es opcional y usa una planilla de Google tuya.

## Cómo se juega

1. **Inicio.** La pantalla explica las reglas. Al tocar **Comenzar**, el navegador pide permiso para usar la cámara y, en iPhone, también el movimiento del teléfono.
2. **Los cuatro Salcotines.** Aparecen a tu alrededor: uno adelante, uno a la derecha, uno atrás y uno a la izquierda, con aros fucsia, celeste, amarillo y verde. Como están en cuatro direcciones, nunca se ven todos a la vez.
3. **Mira la secuencia.** Los Salcotines se iluminan uno tras otro: el aro brilla, el Salcotín salta y suena un tono distinto para cada color. Mientras se ilumina cada uno, la **esquina inferior derecha** muestra el recuadro **"Atrapa a este Salcotín"** con el color del aro, así sabes cuál fue aunque esté a tu espalda.
4. **Tu turno.** Arriba aparece "Atrápalos en orden: 1 de 3". Gira el celular y toca los Salcotines en el mismo orden. En este momento el recuadro de la esquina no aparece: hay que recordarlo.
5. **Ronda superada o error.** Si completas la secuencia, sale confeti, aparece "¡Bien!" y empieza la siguiente ronda con un paso más. Si tocas uno equivocado, la pantalla se sacude, aparece "¡Ups!", se ilumina el que correspondía y termina el juego.
6. **Resultado.** Muestra cuántas rondas superaste, el premio si corresponde, el récord de jugadores y un **código único de la partida** para validar el premio en caja.

En computador se juega **arrastrando con el mouse** para mirar alrededor y haciendo clic sobre los Salcotines.

## Premios

| Rondas superadas | Resultado |
| --- | --- |
| 8 o más | **¡PREMIO MAYOR!** |
| 5 a 7 | **¡Lo lograste!** (premio estándar) y cuántas rondas le faltaron para el mayor |
| 4 o menos | Sin premio, con cuántas rondas le faltaron |

La secuencia se acelera a medida que avanzan las rondas (hasta la ronda 10).

## Récord de jugadores y código de partida

Este juego usa **la misma planilla de Google que la Caza relámpago**, con la misma URL. Cada juego guarda sus partidas en su propia hoja y tiene su propio récord, así que no se mezclan:

| Juego | Hoja | Columnas |
| --- | --- | --- |
| Caza relámpago | "Puntajes" | Fecha, Puntaje, Código |
| Salcotín dice | "Salcotín dice" | Fecha, Rondas, Código |

La hoja "Salcotín dice" se crea sola con la primera partida. Para que funcione, la planilla tiene que tener el `Codigo.gs` actualizado (el que acepta varios juegos) y publicado como **nueva versión**.

En `js/main.js`, `RECORD_URL` es la URL de la planilla y `GAME_ID: 'dice'` le indica a la planilla que la partida es de este juego.

**Reiniciar el récord:** en Apps Script, ejecuta `reiniciarRecordSalcotinDice` (solo afecta a este juego) o `reiniciarRecordCaza` (solo a la Caza relámpago).

## Cómo funciona por dentro

| Parte | Qué hace |
| --- | --- |
| Cámara (`getUserMedia`) | Muestra la cámara trasera de fondo, a pantalla completa. |
| Sensores (`DeviceOrientation`) | Leen el giro del celular y mueven la cámara 3D en la misma dirección, para que los Salcotines queden fijos a tu alrededor. |
| three.js (`lib/three.min.js`) | Dibuja los Salcotines, sus aros y el confeti. Es la versión r128, con licencia MIT, guardada en el propio repositorio. |
| Web Audio | Genera los tonos de cada color directamente en el navegador, sin archivos de sonido. |

El rastreo es **de rotación**: los Salcotines se mantienen en su lugar cuando la persona gira, pero no se acercan si camina. Funciona igual en iPhone y en Android.

## Estructura del repositorio

```
index.html          Pantallas, marcador de ronda, recuadro "Atrapa a este Salcotín" y resultado
css/style.css       Estilos
js/main.js          Toda la lógica del juego
lib/three.min.js    Librería 3D (three.js r128)
assets/
  fondo.png         Imagen de fondo (degradado)
  intro.png         Cartel de la pantalla de inicio
  1.png             Salcotín
  2.png             Premio (estándar y mayor)
  amarillo.png      Confeti amarillo
  celeste.png       Confeti celeste
  rosa.png          Confeti rosa
.nojekyll           Le indica a GitHub Pages que publique los archivos tal cual
```

## Cómo personalizarlo

Casi todo se ajusta al inicio de `js/main.js`.

| Ajuste | Para qué sirve |
| --- | --- |
| `GOAL` / `BIG_GOAL` | Rondas superadas para el premio estándar (5) y el mayor (8). |
| `SHOW_ON_MS` / `SHOW_GAP_MS` | Cuánto se ilumina cada Salcotín y la pausa entre uno y otro, al inicio y desde la ronda 10. Más bajo = más difícil. |
| `FIRST_ROUND_LENGTH` | Largo de la secuencia en la ronda 1. |
| `SHOW_TARGET_DURING_TURN` | `true` = modo fácil: la esquina también muestra cuál toca durante tu turno. |
| `DISTANCE` / `HEIGHT` / `PLANE_HEIGHT` | Distancia, altura y tamaño de los Salcotines. |
| `SOUND` | `false` para jugar sin sonido. |
| `TAP_TOLERANCE_PX` | Distancia a la que un toque cerca de un Salcotín también cuenta. |
| `MAX_ROUNDS` | Tope de rondas: quien llegue ahí termina el juego ganando. |

**Colores y tonos.** En `COLORS` se cambian el color del aro de cada Salcotín (`hex`) y su tono (`tone`, en Hz).

**Imagen del premio mayor.** En `PRIZES`, cambia `image: 'assets/2.png'` del premio mayor por otra imagen que subas a `assets`.

**Textos.** Están en `TEXTS` (instrucciones, "¡Bien!", "¡Ups!", resultado, récord). Las reglas de la pantalla de inicio y el texto "Atrapa a este Salcotín" están en `index.html`.

## Publicar

1. Sube todos los archivos a un repositorio nuevo de GitHub.
2. En **Settings → Pages**, elige **Deploy from a branch**, con la rama `main` y la carpeta `/ (root)`.
3. Espera a que la pestaña **Actions** quede en verde.
4. Abre el sitio en el celular, de preferencia en una pestaña privada la primera vez.

## Requisitos para quien juega

- Abrir el link en **Safari** (iPhone) o **Chrome** (Android), no dentro de Instagram o WhatsApp.
- Aceptar los permisos de cámara y de movimiento.
- Tener el **sonido activado** ayuda a recordar la secuencia (en iPhone, revisar que no esté en silencio).
- Jugar en un lugar donde se pueda girar completo con tranquilidad.
