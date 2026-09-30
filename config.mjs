export const CONFIG = {
  "empresa": "CasaNorte",
  "datos_demo": "Todos los registros y políticas de ejemplo son ficticios.",
  "casos": {
    "tickets": {
      "required": [
        "ticket_id",
        "canal",
        "asunto",
        "mensaje"
      ],
      "type": "choice",
      "prompt": "¿Qué equipo debe atender el motivo principal expresado en el asunto y el mensaje? Elige otro si falta contexto o ningún equipo encaja.",
      "criteria": {
        "facturacion": "Cobros, comprobantes de pago, facturas o devolución de dinero.",
        "logistica": "Entrega, seguimiento, dirección, paquete perdido, talla incorrecta o cambios físicos de un pedido.",
        "soporte_producto": "Funcionamiento, averías, instalación o uso del producto recibido.",
        "ventas": "Preguntas previas a la compra sobre productos, precio o disponibilidad.",
        "otro": "Información insuficiente, tema ajeno o motivo que no encaja en las opciones anteriores."
      }
    },
    "resenas": {
      "required": [
        "resena_id",
        "producto",
        "comentario"
      ],
      "type": "score",
      "prompt": "¿Qué nivel de insatisfacción expresa el comentario del cliente? Evalúa únicamente lo expresado; no infieras emociones ni riesgo de abandono que no estén descritos.",
      "criteria": [
        "Baja: satisfacción, descripción neutral o ausencia de una queja o malestar explícito.",
        "Media: expresa una queja, decepción o molestia moderada sin enfado intenso.",
        "Alta: expresa enfado intenso, acusaciones graves sobre el servicio o un rechazo explícito y fuerte de volver a comprar."
      ],
      "labels": [
        "BAJA",
        "MEDIA",
        "ALTA"
      ]
    },
    "respuestas": {
      "required": [
        "respuesta_id",
        "mensaje_cliente",
        "respuesta_propuesta",
        "politica_aplicable"
      ],
      "type": "noul",
      "prompt": "¿La respuesta propuesta está respaldada por la política aplicable y los hechos disponibles en el mensaje del cliente? Una promesa, condición o hecho no respaldado implica no. No evalúes otras leyes o políticas externas.",
      "criteria": {
        "true": "Todas las afirmaciones, condiciones y compromisos de la respuesta están respaldados por la política de esta fila y los hechos de su mensaje. Puede pedir datos o explicar condiciones sin prometer un resultado.",
        "false": "Contradice la política o afirma hechos, plazos, aprobaciones o compromisos que no constan en el contexto. Falta información para respaldar alguna afirmación."
      }
    }
  }
};
