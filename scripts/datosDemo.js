// Datos de ejemplo tomados de la cotizacion 0039-2026V1 (cliente Ingrid Yohana Arenas Parra). SOLO DEMO.
export const DATOS_DEMO = {
  cliente: {
    cedula_nit: "1093754689", nombre: "Ingrid Yohana Arenas Parra", correo: "pet.food.bucaramanga@gmail.com", telefono: "3015607648",
    direccion: "Calle 39 No. 19 - 24 B. Bolivar", ciudad: "Bucaramanga ", departamento: "Santander", cargo: "Representante Legal",
    nombre_contacto: "Ingrid Yohana Arenas Parra", tipo_usuario: "externo", tipo_persona: "juridica",
  },
  necesidad: "Análisis fisicoquímico de alimento para mascotas (demo).",
  items: [
    { numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", codigo_referencia: "*", nombre_ensayo: "Fibra Cruda", unidad: "%", metodo: "INTERNO -GOMEFC.01 V02 2024-09-23", tecnica: "Hidròlisis Acida y Bàsica", cantidad: 2, precio_unitario: 133900, costo_ensayo: 267800, tercerizado: true, acreditado_res1619: false },
    { numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", codigo_referencia: "2", nombre_ensayo: "Cenizas", unidad: "%", metodo: "AOAC 900.02 C:2023 Modificado", tecnica: "Gravimetría", cantidad: 2, precio_unitario: 15000, costo_ensayo: 30000, tercerizado: false, acreditado_res1619: true },
    { numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", codigo_referencia: "4", nombre_ensayo: "Proteína", unidad: "%", metodo: "AOAC 981.10:2023 Modificado", tecnica: "Volumetría (Kjeldhal)", cantidad: 2, precio_unitario: 15000, costo_ensayo: 30000, tercerizado: false, acreditado_res1619: true },
    { numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", codigo_referencia: "3", nombre_ensayo: "Grasas", unidad: "%", metodo: "AOAC 920.39 C:2023 Modificado", tecnica: "Gravimetría (Soxhlet)", cantidad: 2, precio_unitario: 15000, costo_ensayo: 30000, tercerizado: false, acreditado_res1619: true },
    { numero_item: 1, descripcion_item: "Descripción de la muestra a ensayar", codigo_referencia: "1", nombre_ensayo: "Humedad", unidad: "%", metodo: "AOAC 925.45 B:2023 Modificado", tecnica: "Gravimetría", cantidad: 2, precio_unitario: 15000, costo_ensayo: 30000, tercerizado: false, acreditado_res1619: true },
  ],
};
