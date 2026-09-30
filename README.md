# Jev local · CasaNorte

Demo para cargar un Excel, revisar las filas, pedir decisiones a Jev y descargar el archivo con `decision_jev` y `probabilidad_decision`.

El front y el servidor corren en tu computador. La única llamada de IA es a Jev mediante la API de TypeSafe. La lectura del Excel, validación, tabla, progreso y exportación se ejecutan con código.

## Arranque

Necesitas [Node.js 22 o posterior](https://nodejs.org/en/download). No requiere `npm install` ni compilación.

```bash
git clone https://github.com/zarruk/jev-local-casanorte.git
cd jev-local-casanorte
node abrir.mjs
```

El lanzador comprueba que el servidor responda antes de intentar abrir `http://localhost:8787` en el navegador. Mantén la terminal abierta y usa `Ctrl+C` para cerrar el servidor.

También puedes abrir `iniciar.command` en Mac, `iniciar.bat` en Windows o ejecutar `sh iniciar.sh` en Linux. Para iniciar el servidor sin abrir el navegador, ejecuta `node server.mjs`.

## Configurar Jev

1. Obtén tu propia API key y acceso a Jev en [TypeSafe](https://typesafe.ai).
2. En el navegador, abre **Configurar Jev** e introduce la clave.
3. Carga un Excel o elige uno de los tres ejemplos.
4. Pulsa **Analizar**. Los resultados aparecen conforme termina cada lote.
5. Descarga el Excel. Puedes descargar el registro JSON para revisar las respuestas estructuradas.

La clave introducida en la interfaz se mantiene en la memoria del servidor local hasta cerrarlo. No se incluye en el Excel. Para conservarla entre sesiones, copia `.env.example` como `.env` y configura:

```dotenv
TYPESAFE_API_KEY=tu_clave
PORT=8787
```

`.env` está excluido de Git. Cada persona configura su propia clave. Las llamadas necesitan internet y están sujetas a las condiciones y el consumo de TypeSafe.

## Los tres ejemplos

Todos los registros y políticas son ficticios. Cada archivo contiene 15 casos.

| Archivo | Caso de uso | Tipo de pregunta |
| --- | --- | --- |
| `public/ejemplos/01_Tickets_soporte.xlsx` | Asignar el equipo que debe atender un ticket | Choice |
| `public/ejemplos/02_Resenas_clientes.xlsx` | Evaluar el nivel de insatisfacción de una reseña | Score |
| `public/ejemplos/03_Revision_respuestas.xlsx` | Evaluar si una respuesta está respaldada por la política | Noul |

Encabezados obligatorios en la fila 1:

- Tickets: `ticket_id`, `canal`, `asunto`, `mensaje`.
- Reseñas: `resena_id`, `producto`, `comentario`.
- Respuestas: `respuesta_id`, `mensaje_cliente`, `respuesta_propuesta`, `politica_aplicable`.

Las columnas de salida existentes se reevaluarán al analizar. Las filas fallidas o pendientes quedan sin decisión ni probabilidad en la exportación. Una descarga incompleta lleva el sufijo `_parcial`.

## Qué significa la probabilidad

La columna es una estimación devuelta por Jev para la decisión mostrada. No es una explicación textual ni una tasa de acierto comprobada con estos datos.

- Choice: probabilidad de la opción elegida por Jev.
- Score: probabilidad del nivel más probable. El valor continuo de Score queda en el registro JSON. Los empates muestran `EMPATE` y probabilidad vacía.
- Noul: probabilidad de SÍ, o su complemento si la decisión es NO. En 0.5 se muestra `INCIERTO` y probabilidad vacía.

## Código

| Archivo | Función |
| --- | --- |
| `public/index.html` | Interfaz y estilos |
| `public/app.mjs` | Lectura del Excel, tabla, streaming y descarga |
| `config.mjs` | Columnas, preguntas y criterios de los tres casos |
| `core.mjs` | Validación y conversión de respuestas a columnas |
| `analysis.mjs` | Peticiones a Jev, lotes y reintentos |
| `server.mjs` | Servidor HTTP local y configuración de la clave |
| `abrir.mjs` | Lanzador con comprobación HTTP y apertura del navegador |
| `pruebas.mjs` | Pruebas con respuestas de TypeSafe simuladas |

Endpoint: `POST https://api.typesafe.ai/v1/systemone`. Modelo: `jev-latest`. Hasta 10 preguntas por lote y 4 lotes en paralelo. [Contrato de la API](https://docs.typesafe.ai/api).

## Pruebas y límites

```bash
node pruebas.mjs
```

Las 24 pruebas comprueban lectura y exportación de los tres Excel, XLS heredado, validación de resultados, errores HTTP, reintentos y streaming por HTTP local. Usan respuestas de Jev simuladas y no consumen API. La integración real requiere probar con una clave válida de TypeSafe.

Se admiten XLS y XLSX de hasta 5 MB, con hasta 500 casos por pestaña. La pestaña debe caber en 1000 filas y 26 columnas, con IDs únicos. La descarga siempre es XLSX. Usa las plantillas para el demo: la conservación de macros, gráficos y otras funciones avanzadas de Excel no está cubierta.

Si el puerto está ocupado, cierra la otra instancia o cambia `PORT` en `.env`. No abras `public/index.html` directamente; usa la dirección del servidor local.

SheetJS Community Edition está incluido en el proyecto, sin dependencias de CDN durante el uso. Consulta `THIRD_PARTY.txt` y `LICENSE-SheetJS.txt`.
