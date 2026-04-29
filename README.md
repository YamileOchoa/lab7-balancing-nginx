# Lab7 — Balanceo de Carga (Entorno Local)

Aplicación web con **LOGIN + CRUD de productos** y balanceo de carga con **Nginx Round Robin**, construida con Node.js + Express + MySQL, containerizada con Docker Compose.

---

## Requisitos previos

- Git
- Docker Desktop instalado y corriendo

---

## Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd LAB7
```

---

## Estructura del proyecto

```
LAB7/
├── backend/
│   ├── node_modules/
│   ├── public/
│   │   └── index.html
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
├── .gitignore
├── docker-compose.yml
├── dockerfile
├── init.sql
├── nginx.conf
└── README.md
```

---

## Construir e iniciar los contenedores

```bash
docker compose up --build
```

Esto levantará:

| Servicio     | Descripción                        | Puerto interno |
|--------------|------------------------------------|----------------|
| `db`         | MySQL con base de datos `lab7db`   | 3306           |
| `backend1`   | Instancia A del servidor Node.js   | 8081           |
| `backend2`   | Instancia B del servidor Node.js   | 8082           |
| `backend3`   | Instancia C del servidor Node.js   | 8083           |
| `nginx`      | Proxy inverso con Round Robin      | 80             |

---

## Verificar que los contenedores estén corriendo

```bash
docker compose ps
```

```bash
docker compose logs nginx
docker compose logs backend1
```

---

## Acceder a la aplicación

Abre el navegador en:

```
http://localhost
```

Credenciales por defecto:

| Campo    | Valor            |
|----------|------------------|
| Email    | admin@lab7.com   |
| Password | admin123         |

---

## Pruebas del balanceo de carga

### Desde el navegador

Recarga la página varias veces y observa el indicador de instancia en la esquina superior derecha. Debería rotar entre:

- `Instancia A - Puerto 8081`
- `Instancia B - Puerto 8082`
- `Instancia C - Puerto 8083`

### Desde la terminal con `curl`

Ejecuta el siguiente comando 3 veces para ver la rotación Round Robin:

```bash
curl -s -X POST http://localhost/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lab7.com","password":"admin123"}' | grep backend
```

Deberías ver en la respuesta el campo `"backend"` cambiando en cada petición:

```json
{"token":"...","backend":"Instancia A - Puerto 8081"}
{"token":"...","backend":"Instancia B - Puerto 8082"}
{"token":"...","backend":"Instancia C - Puerto 8083"}
```

---

## Pruebas del CRUD

Primero obtén el token:

```bash
TOKEN=$(curl -s -X POST http://localhost/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lab7.com","password":"admin123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

### Listar productos

```bash
curl -s http://localhost/productos \
  -H "Authorization: Bearer $TOKEN"
```

### Crear producto

```bash
curl -s -X POST http://localhost/productos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nombre":"Laptop","descripcion":"Laptop con 1tb de almacenamiento, tarjeta grafica 3050 RTX","precio":2500.00}'
```

### Actualizar producto

```bash
curl -s -X PUT http://localhost/productos/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"nombre":"Laptop Pro","descripcion":"Descripcion actualizada","precio":2999.99}'
```

### Eliminar producto

```bash
curl -s -X DELETE http://localhost/productos/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Detener los contenedores

```bash
docker compose down
```

Para eliminar también los volúmenes (base de datos):

```bash
docker compose down -v
```

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f

# Reiniciar solo nginx
docker compose restart nginx

# Ver imágenes generadas
docker images
```
---

> 💡 **¿Qué logramos?** Un balanceador de carga real con Nginx distribuyendo tráfico entre 3 instancias Node.js en modo Round Robin, con MySQL como base de datos compartida y autenticación JWT — todo corriendo localmente con Docker Compose. 🎉