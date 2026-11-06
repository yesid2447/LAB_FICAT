// Textos fijos del formato CAT–ST–OC–F–002 v5, copiados tal cual del PDF oficial 0039-2026V1
// (incluidas sus particularidades de ortografia). El sistema NO los modifica.
export const TEXTOS_0039 = {
  encabezado_laboratorio: [
    "Laboratorio de Caracterización Fisicoquímica de Alimentos del Centro Agroturístico",
    "“LABFICAT” de San Gil, Santander",
    "NIT: 899.999.034-1",
    "Dirección: Calle 22 No. 09 – 82, San Gil, Santander",
    "Correo electrónico: labficat@sena.edu.co",
  ],
  observacion_tercerizado: "**Los parámetros ofertados se tercerizan con laboratorio externo. - El cliente asume los costos  y se hace responsable del envio de muestras tanto a laboratorio interno como externo. ",
  observaciones_servicio: [
    "1. Las muestras deben ser recolectadas por el cliente.",
    "2. En caso de solicitar alguna modificación o inclusión al servicio se debe actualizar la versión de la cotización.",
    "3. El laboratorio se abstiene de emitir declaraciones de conformidad, opiniones e interpretaciones.",
    "4. <b><i><u>Simbología:</u></i></b> <span style=\"color:#e00\">°</span> Ensayo con aplicación de estándares de calidad de acuerdo a la Resolución 1619:2015 ante la Secretaria de Salud Departamental (SSD).",
  ],
  titulo_acepto: "Acepto las condiciones del servicio descritas en la presente oferta incluidos sus anexos",
  secciones: [
    { titulo: "Aceptación del servicio", lineas: [
      "- El cliente es responsable de suministrar la información de los parámetros a analizar de acuerdo a sus requerimientos normativos.",
      "- Si el cliente presenta alguna inconformidad con los términos de la cotización deberá manifestarlo antes de iniciar los análisis, con el fin de realizar las modificaciones necesarias y actualizar la versión de la cotización, para proceder a la aceptación de la misma.",
      "- Se considera que el cliente acepta la oferta de servicios si firma (manuscrita o electrónicamente) la Oferta de servicios CAT–ST–OC–F–002, responde confirmando la aceptación vía WhatsApp o correo electrónico institucional labficat@sena.edu.co o mediante la firma del formato Recepción de muestras CAT–ST–MI–F–002 al momento de hacer la entrega de muestras en el laboratorio LABFICAT.",
      "- La aceptación de la oferta de servicios implica que el cliente esta de acuerdo con todas las condiciones aquí descritas, incluyendo que las muestras se analicen por las técnicas, métodos y limites de cuantificación indicados para cada uno de los ensayos.",
      "- El cliente se compromete a no ejercer presiones indebidas sobre el laboratorio y su personal con la intención de acelerar el proceso de análisis o modificar los resultados del servicio.",
    ] },
    { titulo: "Condiciones comerciales", lineas: [
      "- Forma de Pago: se debe realizar la totalidad del pago de la presente oferta de servicios como máximo antes de emitir el informe de resultados.",
      "- Para realizar el pago podrá acercarse al área de producción de centro y solicitar Prefactura y cupón de pago el cual podrá cancelar en cualquier corresponsal Bancolombia.",
      "- Únicamente se dará por cancelado el servicio cuando se envíe el comprobante de pago vía WhatsApp o correo electrónico institucional labficat@sena.edu.co y se verifique el pago con el área de producción de centro.",
      "- La recepción y procesamiento de las muestras se realizara en días hábiles de Lunes a Viernes en los horarios de 08:00 am - 12:00 pm y 02:00 pm - 05:00 pm.",
      "- La fecha de entrega de resultados mencionada en la presente oferta está contemplada desde la fecha de recepción de las muestras al laboratorio, teniendo en cuenta solo días hábiles.",
      "- El informe de resultados se entregara de acuerdo a las condiciones pactadas en la presente oferta, una vez sean analizadas las muestras y realizado el respectivo informe de resultados.",
    ] },
    { titulo: "Condiciones técnicas", lineas: [
      "- El laboratorio LABFICAT no es responsable de la recolección ni del transporte de las muestras ya que el servicio de muestreo debe ser realizado por el cliente.",
      "- El laboratorio  LABFICAT solo se hace responsable del ítem de ensayo desde el momento de la recepción de la muestra y no garantiza los criterios de calidad considerados durante la recolección del ítem de ensayo.",
      "- Solo se guardaran remanentes de las muestras cuando el cliente lo solicite por escrito y deberá quedar constancia en la aceptación del servicio a través de correo electrónico institucional labficat@sena.edu.co.",
      "- Aquellos resultados cuestionados por el cliente serán tratados de acuerdo al procedimiento de Quejas CAT-ST-QJ-P-001. De requerir reanálisis se realizarán sobre la misma muestra que el cliente suministro inicialmente y que se encuentra bajo la custodia del laboratorio LABFICAT, si los resultados del reanálisis confirman los datos originales, el cliente asumirá los costos adicionales asociados al reanálisis.",
    ] },
    { titulo: "Garantía del servicio", lineas: [
      "- El laboratorio LABFICAT garantiza la protección de la confidencialidad de la información y de los derechos de propiedad que los clientes tienen sobre sus resultados, asimismo, garantiza la imparcialidad e integridad operativa en las actividades de la Organización.",
      "- El laboratorio LABFICAT reconoce que la información del cliente es confidencial y esta solo será revelada si la ley o el mismo lo disponen. Cuando la información sea solicitada por la ley, se notificará mediante correo electrónico institucional al cliente que la información será divulgada siempre y cuando la ley no lo prohíba, de acuerdo a lo estipulado en el Procedimiento de imparcialidad y confidencialidad CAT–ST–IC–P–001.",
    ] },
    { titulo: "Calidad del servicio", lineas: [
      "- El laboratorio LABFICAT se encuentra inscrito en la Red Nacional de Laboratorios (RELAB) con el còdigo NULAB LRD686790000387, y ha sido visitado por la Secretaría de Salud Departamental (SSD) para la verificación de la aplicación de estándares de calidad de acuerdo a la Resolución 1619:2015 en la matriz alimentos mediante circular con radicado No. 20250194818. ",
      "- El laboratorio LABFICAT participa en Pruebas de Desempeño conforme a lo establecido en el inciso a) del numeral 7.7.2. Aseguramiento de la validez de los resultados de la norma NTC ISO/IEC 17025:2017.",
    ] },
  ],
};
// Texto por defecto de las observaciones del servicio cuando el laboratorista las edita
export const OBS_SERVICIO_TEXTO = TEXTOS_0039.observaciones_servicio.map((l) => l.replace(/<[^>]+>/g, "")).join("\n");
