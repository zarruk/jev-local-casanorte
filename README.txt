JEV LOCAL · CASANORTE

Proyecto de código para compartir y ejecutar en cada computador.
No necesita npm install, compilación, Google ni cuenta de ChatGPT.
Incluye el lector de Excel y todos los archivos del front.

ARRANQUE
1. Instala Node.js 22 o posterior: https://nodejs.org
2. Descomprime el ZIP completo.
3. Windows: abre iniciar.bat.
   Mac: abre iniciar.command. Si no permite ejecutarlo, usa la terminal.
   Mac/Linux/Windows por terminal: entra en la carpeta y ejecuta:
       node server.mjs
4. El lanzador abre http://localhost:8787 cuando el servidor responde.
   Si usaste node server.mjs, abre esa dirección manualmente.
5. En Configurar Jev, introduce tu propia API key de TypeSafe.
   Obtener acceso: https://typesafe.ai
6. Elige un ejemplo o sube tu Excel. Revisa las filas y pulsa Analizar.
   Las decisiones aparecen conforme termina cada lote.
7. Descarga el Excel con decision_jev y probabilidad_decision.
   Registro JSON descarga la respuesta estructurada de Jev para revisión.
8. Para apagar, pulsa Ctrl+C en la terminal.

La clave introducida en el front vive en la memoria del servidor local y se
pierde al cerrarlo. No se guarda en el navegador ni se incluye en el Excel.
Opcional: copia .env.example como .env e introduce allí tu clave para
conservarla entre sesiones. No compartas ese .env con los asistentes.
Cada asistente configura su propia clave. Las llamadas requieren internet,
acceso autorizado a TypeSafe y están sujetas a sus condiciones y consumo.

LOS TRES ARCHIVOS
public/ejemplos/01_Tickets_soporte.xlsx
  Enrutar 15 tickets al equipo adecuado, con Choice.
  Encabezados: ticket_id, canal, asunto, mensaje.
public/ejemplos/02_Resenas_clientes.xlsx
  Nivel de insatisfacción de 15 reseñas, con Score.
  Encabezados: resena_id, producto, comentario.
public/ejemplos/03_Revision_respuestas.xlsx
  Evaluar si 15 respuestas están respaldadas por la política, con Noul.
  Encabezados: respuesta_id, mensaje_cliente, respuesta_propuesta,
  politica_aplicable.
Todos los datos y políticas de ejemplo son ficticios.

CÓMO FUNCIONA
La lectura, validación, vista previa, progreso y exportación son código.
El Excel se lee en el navegador; al pulsar Analizar se envían solo las
columnas necesarias al servidor local y de allí a Jev en TypeSafe.
Única llamada de IA: POST https://api.typesafe.ai/v1/systemone.
Modelo: jev-latest. Hasta 10 preguntas por lote y 4 lotes en paralelo.
No hay simulación de resultados en la app. Si Jev falla, se muestra error.

La probabilidad expresa la estimación de Jev para la decisión mostrada.
No es una explicación textual ni una tasa de acierto comprobada.
Choice: probabilidad de la opción elegida.
Score: etiqueta del nivel más probable; se conserva el score continuo en
el registro JSON. En empate se muestra EMPATE y probabilidad vacía.
Noul: si el resultado es NO, se muestra 1 menos la probabilidad de SÍ.
En 0.5 se muestra INCIERTO y probabilidad vacía.

FORMATOS Y LÍMITES
XLS y XLSX, hasta 5 MB y 200 casos por pestaña, encabezados en fila 1.
La pestaña debe caber en 1000 filas y 26 columnas, con IDs únicos.
Puedes seleccionar la pestaña si el archivo contiene varias compatibles.
Descarga siempre XLSX. Las filas fallidas o pendientes quedan sin decisión
ni probabilidad; una descarga incompleta lleva el sufijo _parcial.
Se conservan las entradas, otras pestañas y fórmulas ordinarias.
El lector no garantiza conservar macros, gráficos y características
avanzadas de Excel. Usa las plantillas de ejemplo para la clase.

ARCHIVOS PARA MODIFICAR
public/index.html: interfaz y estilos.
public/app.mjs: lectura del Excel, tabla, streaming y descarga.
config.mjs: columnas, preguntas, opciones y políticas de cada decisión.
core.mjs: validación y conversión de respuestas a columnas.
analysis.mjs: peticiones a Jev, lotes, paralelismo y reintentos.
server.mjs: servidor Node local, clave y rutas HTTP.
abrir.mjs: arranque y apertura del navegador tras comprobar el servidor.
pruebas.mjs: pruebas con respuestas de TypeSafe simuladas.

COMPROBACIONES
Ejecuta node pruebas.mjs, o npm test.
Las pruebas no consumen API ni verifican decisiones reales del modelo.
La integración real requiere probar con una clave válida de TypeSafe.
Contrato de API: https://docs.typesafe.ai/api

PROBLEMAS FRECUENTES
No abras index.html directamente; usa http://localhost:8787.
Si el puerto está ocupado, cierra la otra instancia o cambia PORT en .env.
HTTP 401 de TypeSafe: revisa la clave y el acceso a la API.
HTTP 429/529/503: la app reintenta hasta 3 intentos por lote.
Puedes detener y descargar los resultados parciales ya recibidos.

DISTRIBUCIÓN
Comparte el ZIP original, o la carpeta completa sin .env, sin tu clave y
sin archivos de clientes. El servidor escucha solo en este equipo.
La dependencia SheetJS se distribuye bajo Apache 2.0; consulta
THIRD_PARTY.txt y LICENSE-SheetJS.txt.
