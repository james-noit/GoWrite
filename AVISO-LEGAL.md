# Aviso legal y de privacidad de GoWrite

> Plantilla orientativa, no es asesoramiento jurídico. Antes de publicar la aplicación
> de forma pública o comercial, revisa este texto (y complétalo con tus datos) con un
> profesional si aplican normas como el RGPD o la LSSI-CE en tu jurisdicción.

## 1. Titularidad

- **Responsable:** [nombre / razón social]
- **Contacto:** [email de contacto]
- **Aplicación:** GoWrite, editor de texto 100% en el navegador (sin servidor propio de backend).

## 2. Naturaleza de la aplicación

GoWrite es una aplicación **enteramente cliente (frontend)**: se ejecuta por completo en el
navegador del usuario. No existe un servidor propio que reciba, procese o almacene los
documentos, el contenido escrito ni la configuración de la persona usuaria.

## 3. Datos que se guardan y dónde

Toda la información se guarda **únicamente en `localStorage` del navegador del propio
usuario**, nunca en un servidor de GoWrite:

- El contenido del documento en edición (para poder recuperarlo si se recarga la página).
- La preferencia de tema (claro/oscuro).
- La configuración del proveedor de IA que la persona usuaria decida conectar, incluida
  la clave API que introduzca.

Esta información no sale del navegador salvo en el caso descrito en el punto siguiente,
y desaparece si el usuario borra los datos de navegación de ese sitio.

## 4. Conexión con proveedores de IA

Si la persona usuaria activa y configura un proveedor de IA (OpenAI, Anthropic, Google
Gemini, Mistral, Cohere o un servidor local/personalizado como Ollama o LM Studio), las
peticiones se realizan **directamente desde su navegador hacia el proveedor elegido**,
usando la clave API que ella misma proporciona. GoWrite no intermedia, reenvía ni
almacena esas peticiones ni sus respuestas en ningún servidor propio.

El tratamiento de esos datos por parte del proveedor de IA se rige por la política de
privacidad de dicho proveedor, ajena a GoWrite.

## 5. Cookies y rastreo

GoWrite no utiliza cookies propias ni de terceros con fines de rastreo o analítica.

## 6. Propiedad intelectual

El código propio de GoWrite es de [nombre del titular / "uso libre", según corresponda].
La aplicación utiliza además dependencias de código abierto de terceros; sus licencias y
avisos de copyright se recogen en [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## 7. Cambios en este aviso

Este aviso puede actualizarse para reflejar cambios en la aplicación. Se recomienda
revisar su fecha de última actualización.

_Última actualización: [fecha]_
