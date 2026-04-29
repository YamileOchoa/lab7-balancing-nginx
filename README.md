# Lab7 — Balanceo de Carga

Aplicación web con **LOGIN + CRUD de productos** y balanceo de carga, construida con Node.js + Express + MySQL. Implementada en dos entornos: local con Docker Compose + Nginx, y en la nube con AWS Application Load Balancer + EC2.

---

# PARTE A — Entorno Local

Balanceo de carga con **Nginx Round Robin** entre 3 instancias Node.js, containerizada con Docker Compose.

## Requisitos previos

- Git
- Docker Desktop instalado y corriendo

---

## Clonar el repositorio

```bash
git clone https://github.com/YamileOchoa/lab7-balancing-nginx.git
cd lab7-balancing-nginx
```

---

## Estructura del proyecto

```
lab7-balancing-nginx/
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

| Servicio   | Descripción                      | Puerto interno |
|------------|----------------------------------|----------------|
| `db`       | MySQL con base de datos `lab7db` | 3306           |
| `backend1` | Instancia A del servidor Node.js | 8081           |
| `backend2` | Instancia B del servidor Node.js | 8082           |
| `backend3` | Instancia C del servidor Node.js | 8083           |
| `nginx`    | Proxy inverso con Round Robin    | 80             |

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

| Campo    | Valor          |
|----------|----------------|
| Email    | admin@lab7.com |
| Password | admin123       |

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

---
---

# PARTE B — Nube de AWS

Balanceo de carga con **Application Load Balancer (ALB)** entre 2 instancias EC2 en distintas zonas de disponibilidad, dentro de una VPC privada.

## Arquitectura

```
Internet → Application LB (HTTP:80) → web-server-1 (EC2 t3.micro - us-east-1a)
                                     → web-server-2 (EC2 t3.micro - us-east-1b)
```

- VPC: `10.0.0.0/16`
- MySQL instalado en `web-server-1` (IP privada compartida con `web-server-2`)

---

## Paso 1 — Crear la VPC

1. AWS Console → **VPC** → **Crear VPC** → **VPC y más**
2. Configura:

| Campo | Valor |
|-------|-------|
| Nombre | `lab7-vpc` |
| CIDR IPv4 | `10.0.0.0/16` |
| Zonas de disponibilidad | `2` |
| Subredes públicas | `2` |
| Subredes privadas | `0` |
| NAT Gateway | `Ninguna` |

3. **Crear VPC** ✅

---

## Paso 2 — Crear el Security Group

1. EC2 → **Grupos de seguridad** → **Crear grupo de seguridad**
2. Configura:

| Campo | Valor |
|-------|-------|
| Nombre | `lab7-sg` |
| VPC | `lab7-vpc` |

3. Reglas de entrada:

| Tipo | Puerto | Origen |
|------|--------|--------|
| SSH | 22 | `0.0.0.0/0` |
| HTTP | 80 | `0.0.0.0/0` |
| TCP personalizado | 8081 | `0.0.0.0/0` |
| TCP personalizado | 8082 | `0.0.0.0/0` |
| MySQL/Aurora | 3306 | `0.0.0.0/0` |

4. **Crear grupo de seguridad** ✅

---

## Paso 3 — Crear las instancias EC2

### web-server-1

1. EC2 → **Lanzar instancias**
2. Configura:

| Campo | Valor |
|-------|-------|
| Nombre | `web-server-1` |
| AMI | `Ubuntu 26.04 LTS` |
| Tipo | `t3.micro` |
| Key pair | `lab7-key` (crear y descargar) |
| VPC | `lab7-vpc` |
| Subred | `us-east-1a` |
| IP pública | `Habilitar` |
| Security group | `lab7-sg` |

### web-server-2

Igual que la anterior pero:

| Campo | Valor |
|-------|-------|
| Nombre | `web-server-2` |
| Subred | `us-east-1b` |
| Key pair | `lab7-key` (la misma) |

---

## Paso 4 — Conectarse a las instancias por SSH

Desde Git Bash en la carpeta donde está `lab7-key.pem`:

```bash
chmod 400 lab7-key.pem

# web-server-1
ssh -i "lab7-key.pem" ubuntu@<IP_PUBLICA_WEB_SERVER_1>

# web-server-2 (en otra terminal)
ssh -i "lab7-key.pem" ubuntu@<IP_PUBLICA_WEB_SERVER_2>
```

---

## Paso 5 — Instalar MySQL en web-server-1

```bash
sudo apt-get update
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo systemctl enable mysql

sudo mysql
```

Dentro de MySQL:

```sql
CREATE DATABASE IF NOT EXISTS lab7db;
USE lab7db;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL
);

INSERT INTO usuarios (email, password) VALUES ('admin@lab7.com', 'admin123');

CREATE USER 'root'@'%' IDENTIFIED BY '1234';
GRANT ALL PRIVILEGES ON lab7db.* TO 'root'@'%';
FLUSH PRIVILEGES;
EXIT;
```

Permitir conexiones remotas:

```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# Cambiar: bind-address = 127.0.0.1
# Por:     bind-address = 0.0.0.0

sudo systemctl restart mysql
```

---

## Paso 6 — Instalar la app en web-server-1

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

git clone https://github.com/YamileOchoa/lab7-balancing-nginx.git
cd lab7-balancing-nginx/backend
npm install

# Actualizar el host de MySQL en index.js
nano index.js
# Cambiar: host: 'db'
# Por:     host: process.env.DB_HOST || '<IP_PRIVADA_WEB_SERVER_1>'

# Crear .env
nano .env
```

Contenido del `.env`:

```
PORT=8081
INSTANCE_ID=A
DB_HOST=<IP_PRIVADA_WEB_SERVER_1>
```

```bash
sudo npm install -g pm2
PORT=8081 INSTANCE_ID=A DB_HOST=<IP_PRIVADA_WEB_SERVER_1> pm2 start index.js --name web-server-1
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

---

## Paso 7 — Instalar la app en web-server-2

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

git clone https://github.com/YamileOchoa/lab7-balancing-nginx.git
cd lab7-balancing-nginx/backend
npm install

# Actualizar el host de MySQL en index.js
nano index.js
# Cambiar: host: 'db'
# Por:     host: process.env.DB_HOST || '<IP_PRIVADA_WEB_SERVER_1>'

# Crear .env
nano .env
```

Contenido del `.env`:

```
PORT=8082
INSTANCE_ID=B
DB_HOST=<IP_PRIVADA_WEB_SERVER_1>
```

```bash
sudo npm install -g pm2
PORT=8082 INSTANCE_ID=B DB_HOST=<IP_PRIVADA_WEB_SERVER_1> pm2 start index.js --name web-server-2
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

> ⚠️ **Importante:** Usar `pm2 startup` + `pm2 save` es clave para que la app siga corriendo si la sesión SSH se cierra o la instancia se reinicia.

---

## Paso 8 — Crear el Target Group

1. EC2 → **Grupos de destino** → **Crear grupo de destino**
2. Configura:

| Campo | Valor |
|-------|-------|
| Tipo de destino | `Instancias` |
| Nombre | `lab7-tg` |
| Protocolo | `HTTP` |
| Puerto | `8081` |
| VPC | `lab7-vpc` |
| Health check path | `/` |

3. Click **Siguiente** → registra las instancias con sus puertos:
   - `web-server-1` → puerto `8081`
   - `web-server-2` → puerto `8082`
4. **Crear grupo de destino** ✅

---

## Paso 9 — Crear el Application Load Balancer

1. EC2 → **Balanceadores de carga** → **Crear balanceador de carga** → **Application Load Balancer**
2. Configura:

| Campo | Valor |
|-------|-------|
| Nombre | `lab7-alb` |
| Esquema | `Orientado a Internet` |
| VPC | `lab7-vpc` |
| Zonas | `us-east-1a` y `us-east-1b` |
| Grupo de seguridad | `lab7-sg` (quitar el predeterminado) |
| Listener | HTTP:80 → `lab7-tg` |

3. **Crear balanceador de carga** ✅

---

## Paso 10 — Probar el ALB

Copia el **DNS del ALB** desde la consola de AWS y prueba en el navegador:

```
http://<DNS_DEL_ALB>
```

Con curl (ejecuta varias veces para ver la rotación):

```bash
curl -s -X POST http://<DNS_DEL_ALB>/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lab7.com","password":"admin123"}' | grep backend
```

Deberías ver alternando entre:

```json
{"token":"...","backend":"Instancia A - Puerto 8081"}
{"token":"...","backend":"Instancia B - Puerto 8082"}
```

---

> 💡 **¿Qué logramos?** Un ALB real en AWS distribuyendo tráfico entre 2 instancias EC2 en distintas zonas de disponibilidad, con Node.js como backend y MySQL como base de datos compartida — todo dentro de una VPC privada. 🎉

## 🧹 Limpieza de recursos AWS
 
> ⚠️ **¡Importante!** AWS cobra por recursos activos. Una vez terminado el laboratorio, elimina todo en el siguiente orden para evitar cargos inesperados en tu cuenta.
 
| Paso | Recurso | Dónde | Acción |
|------|---------|-------|--------|
| 1 | Load Balancer | EC2 → Balanceadores de carga | Selecciona `lab7-alb` → Acciones → **Eliminar** |
| 2 | Target Group | EC2 → Grupos de destino | Selecciona `lab7-tg` → Acciones → **Eliminar** |
| 3 | Instancias EC2 | EC2 → Instancias | Selecciona `web-server-1` y `web-server-2` → Estado → **Terminar instancia** |
| 4 | VPC | VPC → Sus VPCs | Selecciona `lab7-vpc` → Acciones → **Eliminar VPC** |
 
> 💡 Al eliminar la VPC se borran automáticamente las subredes, tablas de ruta e internet gateway asociados.