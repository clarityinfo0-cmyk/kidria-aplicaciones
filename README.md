# 🚀 Guía de Despliegue y Configuración - KIDRIA Web App

Esta guía contiene todos los pasos necesarios para instalar, ejecutar localmente y desplegar tu aplicación full-stack (**React + Express + Vite + Firebase + Gemini AI**) a producción (Vercel, Render, Railway, VPS, etc.) sin ningún error.

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu máquina local:
* **Node.js** (versión 18 o superior recomendada)
* **npm** (incluido con Node.js)
* Una cuenta de **Firebase** (con Firestore Database habilitado)
* Una API Key de **Google Gemini** (si usas funciones de Inteligencia Artificial)

---

## 🛠️ Paso 1: Instalación de Dependencias Localmente

Para descargar el proyecto y preparar todo tu entorno local para el desarrollo o la compilación:

1. Abre tu terminal en la carpeta raíz del proyecto.
2. Ejecuta el comando de instalación de dependencias:
   ```bash
   npm install
   ```
   *Esto descargará todas las librerías necesarias especificadas en el archivo `package.json` (incluyendo `express`, `react`, `firebase`, `stripe`, `lucide-react`, etc.).*

---

## ⚙️ Paso 2: Configuración de Variables de Entorno (`.env`)

Debes configurar tus claves de manera segura. Crea un archivo llamado `.env` en la raíz del proyecto (toma como base el archivo `.env.example` que hemos restaurado para ti) y rellena los siguientes campos:

```env
# Clave API de Gemini (necesaria para el generador de propuestas de IA)
GEMINI_API_KEY="tu_clave_api_aquí"

# URL de tu aplicación (ej. https://mi-app.vercel.app o http://localhost:3000)
APP_URL="https://tu-dominio-aqui.com"

# Claves de Pasarela de Pagos Stripe (Opcional - Si no se proveen, la app simulará los pagos de forma elegante)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Credenciales de Administrador de Firebase (Opcional - Necesario en despliegues externos como Vercel si usas Firebase Admin)
FIREBASE_SERVICE_ACCOUNT='{"type": "service_account", "project_id": "..."}'
FIRESTORE_DATABASE_ID="(default)"
```

> ⚠️ **IMPORTANTE:** Nunca subas el archivo `.env` a repositorios públicos como GitHub. El archivo `.gitignore` ya está configurado para protegerlo.

---

## 💻 Paso 3: Ejecución en Entorno Local

Para validar que todo funcione de manera perfecta en tu computadora antes de subirlo:

1. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```
2. Abre tu navegador en **`http://localhost:3000`**.
3. El servidor Express iniciará en el puerto 3000 y servirá el frontend de React con soporte Hot Module Replacement (HMR).

---

## 📦 Paso 4: Despliegue en Producción

### Opción A: Despliegue Recomendado (Render, Railway, Heroku, VPS)
Dado que esta es una aplicación full-stack con un servidor Express persistente (`server.ts`), la manera más robusta de desplegarla es usando un servidor Node.js completo.

1. **Comando de Construcción (Build Command):**
   ```bash
   npm run build
   ```
   *Esto generará la carpeta estática `dist/` para el cliente de React y compilará el archivo de backend `server.ts` a un bundle súper veloz `dist/server.cjs` usando `esbuild`.*

2. **Comando de Inicio (Start Command):**
   ```bash
   npm start
   ```

3. **Configuración en plataformas de un solo clic:**
   * **Railway:** Crea un nuevo servicio desde tu repo de GitHub. Railway detectará el `package.json` de forma automática, ejecutará el script `build` y arrancará la aplicación con `start`. Solo añade tus variables de entorno en la pestaña *Variables*.
   * **Render:** Crea un "Web Service", selecciona tu repositorio, configura la variable `Start Command` como `npm start` y el `Build Command` como `npm run build`.

---

### Opción B: Despliegue en Vercel (Serverless)
Para subir la aplicación a Vercel con éxito y evitar que el servidor de Express de un error `404` u `H10`, Vercel requiere saber cómo manejar las peticiones del backend.

Hemos incluido un archivo `vercel.json` en la raíz de tu proyecto para indicarle a Vercel que debe enrutar las peticiones `/api/*` hacia una función Serverless Node.js, y las peticiones web directamente a tu frontend de React compilado en `dist/`.

#### Pasos para Vercel:
1. Instala la CLI de Vercel (opcional si lo haces desde el panel de su web):
   ```bash
   npm install -g vercel
   ```
2. Ejecuta el comando de subida:
   ```bash
   vercel
   ```
3. Configura las **Environment Variables** en el panel de Vercel con tus claves del archivo `.env`.
4. ¡Listo! Vercel compilará la SPA y levantará tus funciones del backend de manera instantánea.

---

## 🛠️ Solución de Problemas Comunes

* **Error: "Cannot find module..." al compilar:** Asegúrate de ejecutar `npm install` antes de compilar para garantizar que todas las librerías se encuentren presentes en la carpeta `node_modules`.
* **Advertencias de Gemini API:** El servidor backend está configurado con un sistema de reintentos inteligente (*intelligent retry backoff*). Si el servicio de Gemini experimenta saturación temporal, reintentará automáticamente con modelos alternativos y estables como `gemini-flash-latest` o `gemini-3.1-flash-lite` para que tu usuario nunca vea una pantalla de error.
* **Precios en MXN:** Toda la interfaz de usuario, planes (Starter, Business, Enterprise) y módulos de cotizaciones han sido unificados para mostrar y calcular montos en **pesos mexicanos ($ MXN)**.

---

¡Disfruta de tu plataforma y mucho éxito en tu sociedad de negocios! 🚀💸
