# New-API AI 中转站实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从零搭建基于 New-API 的双节点 AI API 中转站，服务 20-100 名付费用户。

**Architecture:** 国内腾讯云轻量 Nginx 代理 + 海外 RackNerd 新加坡 New-API 全栈服务（MySQL/Redis/Prometheus/Grafana），日志分库存储请求/响应内容。

**Tech Stack:** New-API (Go), Docker Compose, Nginx, MySQL 8.0, Redis 7, Prometheus, Grafana, Certbot

**Design Doc:** `docs/plans/2026-03-07-new-api-deployment-design.md`

---

## Phase 0: 采购与注册（手动操作）

> 此阶段为线下手动操作，无法脚本化。完成后方可进入 Phase 1。

### Task 0.1: 购买域名

**操作：**
1. 访问 https://wanwang.aliyun.com/ 注册/登录阿里云账号
2. 搜索并购买 `.com` 域名（¥69/年）
3. 完成实名认证（需身份证，1-2 个工作日）

**完成标志：** 域名状态为"正常"，可管理 DNS 解析。

---

### Task 0.2: 提交域名备案

**操作：**
1. 阿里云控制台 → ICP 备案 → 开始备案
2. 填写主体信息（个人/企业）
3. 填写网站信息，域名指向腾讯云国内服务器 IP
4. 提交管局审核（1-2 周）

**注意：** 备案期间可先用海外节点 IP 直连测试，备案通过后再切换 DNS 到国内节点。

**完成标志：** 备案号下发（格式如 沪ICP备XXXXXXXX号）。

---

### Task 0.3: 购买海外服务器（RackNerd）

**操作：**
1. 访问 https://www.racknerd.com/
2. 选择新加坡节点 VPS，推荐 2核4G 方案
3. 选择 Ubuntu 22.04 LTS 系统
4. 完成支付（支持支付宝/PayPal）
5. 记录服务器 IP 和 root 密码

**完成标志：** 收到开通邮件，`ssh root@<IP>` 可连接。

---

### Task 0.4: 购买国内服务器（腾讯云轻量）

**操作：**
1. 访问 https://cloud.tencent.com/product/lighthouse
2. 选择 1核1G 轻量应用服务器，上海/广州区域
3. 选择 Ubuntu 22.04 LTS 系统镜像
4. 完成支付（¥40/月，活动价更低）
5. 记录服务器 IP 和登录方式

**完成标志：** 控制台显示实例"运行中"，SSH 可连接。

---

### Task 0.5: 获取 API Key — 国产模型

**操作（每个平台独立，可并行）：**

| 平台 | 地址 | 操作 |
|------|------|------|
| DeepSeek | platform.deepseek.com | 手机号注册 → 创建 API Key → 充值 ¥10+ |
| 通义千问 | dashscope.console.aliyun.com | 阿里云登录 → 开通 DashScope → 创建 Key |
| 智谱 GLM | open.bigmodel.cn | 手机号注册 → 创建 API Key |

**完成标志：** 每个平台获得一个 `sk-xxx` 格式的 API Key。

---

### Task 0.6: 获取 API Key — 海外模型

**前置：** 需要海外手机号（SMS-Activate 接码 $1-3）+ 虚拟信用卡（WildCard 开卡 $10-15）。

**操作：**

| 平台 | 地址 | 操作 |
|------|------|------|
| OpenAI | platform.openai.com | 海外IP注册 → 绑定信用卡 → 创建 API Key → 充值 $10+ |
| Anthropic | console.anthropic.com | 海外IP注册 → 绑定信用卡 → 创建 API Key |
| Google Gemini | aistudio.google.com | Google 账号登录 → 创建 API Key |

**完成标志：** 每个平台获得 API Key，至少 OpenAI + DeepSeek 可用。

---

## Phase 1: 海外主节点 — 系统初始化

### Task 1.1: 连接服务器并更新系统

**Step 1: SSH 连接**

```bash
ssh root@<海外节点IP>
```

Expected: 成功登录到 Ubuntu 22.04 shell。

**Step 2: 更新系统**

```bash
apt update && apt upgrade -y
```

Expected: 所有包更新完成，无报错。

**Step 3: 安装基础工具**

```bash
apt install -y curl wget git vim ufw htop fail2ban ca-certificates gnupg lsb-release
```

Expected: 全部安装成功。

---

### Task 1.2: 创建运维用户

**Step 1: 创建 deploy 用户**

```bash
adduser deploy
# 设置强密码，其他信息回车跳过
```

**Step 2: 配置 sudo 权限**

```bash
usermod -aG sudo deploy
```

**Step 3: 配置 SSH Key 登录（在本地机器执行）**

```bash
ssh-copy-id deploy@<海外节点IP>
```

**Step 4: 验证 deploy 用户可登录**

```bash
ssh deploy@<海外节点IP>
sudo whoami
```

Expected: 输出 `root`，确认 sudo 权限正常。

---

### Task 1.3: 配置防火墙

**Step 1: 配置 UFW 规则**

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

**Step 2: 验证规则**

```bash
sudo ufw status
```

Expected: 显示 22/80/443 三个端口为 ALLOW。

---

### Task 1.4: 安装 Docker（官方仓库方式）

**Step 1: 添加 Docker 官方 GPG 密钥和仓库**

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

**Step 2: 安装 Docker**

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

**Step 3: 将 deploy 用户加入 docker 组**

```bash
sudo usermod -aG docker deploy
newgrp docker
```

**Step 4: 验证**

```bash
docker --version
docker compose version
```

Expected: 两个命令都输出版本号。

---

### Task 1.5: 配置 Docker 日志轮转

**Step 1: 创建 daemon.json**

```bash
sudo cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
```

**Step 2: 重启 Docker**

```bash
sudo systemctl restart docker
```

**Step 3: 验证**

```bash
docker info | grep -A 2 "Logging Driver"
```

Expected: 显示 `json-file`。

---

## Phase 2: 海外主节点 — 服务部署

### Task 2.1: 创建项目目录结构

**Step 1: 切换到 deploy 用户并创建目录**

```bash
su - deploy
mkdir -p /home/deploy/new-api/{config/nginx/conf.d,config/nginx/ssl,config/prometheus,config/mysql-init,data,scripts}
cd /home/deploy/new-api
```

**Step 2: 验证目录结构**

```bash
find /home/deploy/new-api -type d
```

Expected: 显示所有子目录。

---

### Task 2.2: 生成密码并创建 .env

**Step 1: 生成随机密码**

```bash
cd /home/deploy/new-api
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -base64 16)" > .env
echo "REDIS_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "SESSION_SECRET=$(openssl rand -hex 16)" >> .env
echo "GRAFANA_PASSWORD=$(openssl rand -base64 12)" >> .env
echo "DOMAIN=api.yourdomain.com" >> .env
```

> **替换** `api.yourdomain.com` 为你的实际域名。

**Step 2: 保护 .env 文件权限**

```bash
chmod 600 .env
```

**Step 3: 验证并记录密码**

```bash
cat .env
```

Expected: 5 行环境变量，密码为随机字符串。**务必将此内容保存到安全位置。**

---

### Task 2.3: 创建 MySQL 初始化脚本

**Step 1: 写入 init.sql**

```bash
cat > config/mysql-init/init.sql <<'EOF'
CREATE DATABASE IF NOT EXISTS `new-api-log` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
```

**Step 2: 验证**

```bash
cat config/mysql-init/init.sql
```

Expected: 显示 CREATE DATABASE 语句。

---

### Task 2.4: 创建 Prometheus 配置

**Step 1: 写入 prometheus.yml**

```bash
cat > config/prometheus/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'new-api'
    static_configs:
      - targets: ['new-api:3000']
    metrics_path: '/api/prometheus'

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
EOF
```

**Step 2: 验证**

```bash
cat config/prometheus/prometheus.yml
```

Expected: 显示完整 YAML 配置。

---

### Task 2.5: 创建 Nginx 配置

**Step 1: 写入 nginx.conf**

```bash
cat > config/nginx/nginx.conf <<'EOF'
user  nginx;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;
    client_max_body_size 50m;

    gzip on;
    gzip_types text/plain application/json application/javascript text/css;

    include /etc/nginx/conf.d/*.conf;
}
EOF
```

**Step 2: 写入 default.conf**

```bash
cat > config/nginx/conf.d/default.conf <<'EOF'
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass http://new-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    location /grafana/ {
        proxy_pass http://grafana:3000/grafana/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

**Step 3: 验证**

```bash
cat config/nginx/nginx.conf
cat config/nginx/conf.d/default.conf
```

Expected: 两个文件内容正确。

---

### Task 2.6: 创建 docker-compose.yml

**Step 1: 写入 docker-compose.yml**

```bash
cat > docker-compose.yml <<'COMPOSE'
version: '3.8'

services:
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    restart: always
    environment:
      - TZ=Asia/Shanghai
      - SQL_DSN=root:${MYSQL_ROOT_PASSWORD}@tcp(mysql:3306)/new-api
      - LOG_SQL_DSN=root:${MYSQL_ROOT_PASSWORD}@tcp(mysql:3306)/new-api-log
      - REDIS_CONN_STRING=redis://:${REDIS_PASSWORD}@redis:6379/0
      - SESSION_SECRET=${SESSION_SECRET}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - new-api-net
    volumes:
      - ./data/new-api:/data

  mysql:
    image: mysql:8.0
    container_name: mysql
    restart: always
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=new-api
    command: --default-authentication-plugin=mysql_native_password
    volumes:
      - ./data/mysql:/var/lib/mysql
      - ./config/mysql-init:/docker-entrypoint-initdb.d
    networks:
      - new-api-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - ./data/redis:/data
    networks:
      - new-api-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: always
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./data/prometheus:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    networks:
      - new-api-net

  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    restart: always
    networks:
      - new-api-net

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: always
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_SERVER_ROOT_URL=https://${DOMAIN}/grafana/
      - GF_SERVER_SERVE_FROM_SUB_PATH=true
    volumes:
      - ./data/grafana:/var/lib/grafana
    networks:
      - new-api-net

  nginx:
    image: nginx:alpine
    container_name: nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./config/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./config/nginx/conf.d:/etc/nginx/conf.d
      - ./config/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - new-api
      - grafana
    networks:
      - new-api-net

networks:
  new-api-net:
    driver: bridge
COMPOSE
```

**Step 2: 验证**

```bash
docker compose config --quiet && echo "VALID" || echo "INVALID"
```

Expected: 输出 `VALID`。

---

### Task 2.7: 申请 SSL 证书并启动服务

**前置：** 将域名临时解析到海外节点 IP（后续备案通过后改回国内节点）。

**Step 1: 安装 Certbot**

```bash
sudo apt install -y certbot
```

**Step 2: 申请证书**

```bash
sudo certbot certonly --standalone -d api.yourdomain.com
```

> 替换 `api.yourdomain.com` 为实际域名。

Expected: 证书生成成功，路径为 `/etc/letsencrypt/live/api.yourdomain.com/`。

**Step 3: 复制证书到项目目录**

```bash
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem /home/deploy/new-api/config/nginx/ssl/
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem /home/deploy/new-api/config/nginx/ssl/
sudo chown deploy:deploy /home/deploy/new-api/config/nginx/ssl/*.pem
```

**Step 4: 启动全部服务**

```bash
cd /home/deploy/new-api
docker compose up -d
```

Expected: 7 个容器全部启动（new-api, mysql, redis, prometheus, node-exporter, grafana, nginx）。

**Step 5: 验证容器状态**

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected: 所有容器 Status 为 `Up`，nginx 暴露 80/443 端口。

**Step 6: 验证 HTTPS 访问**

```bash
curl -I https://api.yourdomain.com
```

Expected: HTTP 200，返回 New-API 页面。

---

### Task 2.8: 配置 SSL 自动续期

**Step 1: 添加 cron 任务**

```bash
sudo bash -c 'cat > /etc/cron.d/certbot-renew <<EOF
0 3 1 * * root certbot renew --pre-hook "docker compose -f /home/deploy/new-api/docker-compose.yml stop nginx" --post-hook "cp /etc/letsencrypt/live/api.yourdomain.com/*.pem /home/deploy/new-api/config/nginx/ssl/ && docker compose -f /home/deploy/new-api/docker-compose.yml start nginx"
EOF'
```

> 替换 `api.yourdomain.com` 为实际域名。

**Step 2: 验证**

```bash
sudo certbot renew --dry-run
```

Expected: 输出 `Congratulations, all simulated renewals succeeded`。

---

## Phase 3: 国内代理节点部署

> 此阶段在**域名备案通过后**执行。备案期间可直接用海外节点 IP 测试。

### Task 3.1: 初始化国内服务器

**Step 1: SSH 连接**

```bash
ssh root@<国内节点IP>
```

**Step 2: 更新系统并安装工具**

```bash
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx ufw fail2ban
```

**Step 3: 配置防火墙**

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

### Task 3.2: 配置 Nginx 反向代理

**Step 1: 写入配置文件**

```bash
cat > /etc/nginx/sites-available/api-proxy.conf <<'EOF'
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        proxy_pass https://<海外节点IP>:443;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    location /grafana/ {
        proxy_pass https://<海外节点IP>:443/grafana/;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    client_max_body_size 50m;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}
EOF
```

> **替换** `api.yourdomain.com` 和 `<海外节点IP>` 为实际值。

**Step 2: 启用配置**

```bash
ln -s /etc/nginx/sites-available/api-proxy.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
```

Expected: 输出 `syntax is ok` 和 `test is successful`。

---

### Task 3.3: 切换 DNS 并申请国内 SSL

**Step 1: 修改 DNS**

在阿里云万网 DNS 控制台：

```
api.yourdomain.com  →  A 记录  →  <国内节点IP>
```

等待 5-30 分钟生效。

**Step 2: 验证 DNS 解析**

```bash
dig api.yourdomain.com +short
```

Expected: 输出国内节点 IP。

**Step 3: 申请 SSL 证书**

```bash
certbot --nginx -d api.yourdomain.com
```

Expected: 证书申请成功，Nginx 配置自动更新。

**Step 4: 重载 Nginx**

```bash
systemctl reload nginx
```

**Step 5: 验证端到端访问**

```bash
curl -I https://api.yourdomain.com
```

Expected: HTTP 200，通过国内节点 → 海外节点 → New-API 返回页面。

---

## Phase 4: New-API 后台配置

### Task 4.1: 创建管理员并初始化系统

**Step 1: 访问前台**

浏览器打开 `https://api.yourdomain.com`，注册第一个账号（即管理员）。

**Step 2: 进入后台**

点击右上角头像 → 管理后台。

**Step 3: 基础系统设置**

后台 → 系统设置 → 通用设置：

| 配置项 | 值 |
|--------|---|
| 开放注册 | 启用 |
| 邮箱验证 | 启用 |
| 新用户初始额度 | 50000 (对应约 $0.5) |
| 签到功能 | 启用 |
| 签到奖励额度 | 5000 (对应约 $0.05) |

---

### Task 4.2: 配置日志记录

**Step 1: 启用请求/响应内容记录**

后台 → 系统设置 → 日志设置：

| 配置项 | 值 |
|--------|---|
| 记录请求内容 | 启用 |
| 记录响应内容 | 启用 |
| 日志保留天数 | 60 |

---

### Task 4.3: 添加渠道 — 国产模型

**Step 1: 创建渠道分组**

后台 → 渠道管理 → 渠道分组 → 新建：
- 名称: `主力渠道`

再新建：
- 名称: `备用渠道`

**Step 2: 添加 DeepSeek 渠道**

后台 → 渠道管理 → 渠道列表 → 新建：

| 字段 | 值 |
|------|---|
| 类型 | OpenAI |
| 名称 | DeepSeek-主力 |
| 分组 | 主力渠道 |
| Base URL | `https://api.deepseek.com` |
| 模型 | deepseek-chat, deepseek-reasoner |
| 密钥 | `sk-xxx`（你的 DeepSeek Key） |
| 优先级 | 10 |

**Step 3: 添加通义千问渠道**

| 字段 | 值 |
|------|---|
| 类型 | 阿里云DashScope |
| 名称 | 通义千问-主力 |
| 分组 | 主力渠道 |
| 模型 | qwen-max, qwen-plus |
| 密钥 | `sk-xxx`（你的通义 Key） |
| 优先级 | 10 |

**Step 4: 添加智谱渠道**

| 字段 | 值 |
|------|---|
| 类型 | 智谱ChatGLM |
| 名称 | 智谱-主力 |
| 分组 | 主力渠道 |
| 模型 | glm-4-plus |
| 密钥 | `xxx.xxx`（你的智谱 Key） |
| 优先级 | 10 |

**Step 5: 逐个点击"测试"验证连通**

Expected: 每个渠道状态变为绿色"正常"。

---

### Task 4.4: 添加渠道 — 海外模型

**Step 1: 添加 OpenAI 渠道**

| 字段 | 值 |
|------|---|
| 类型 | OpenAI |
| 名称 | OpenAI-主力 |
| 分组 | 主力渠道 |
| 模型 | gpt-4o, gpt-4o-mini |
| 密钥 | `sk-xxx`（你的 OpenAI Key） |
| 优先级 | 10 |

**Step 2: 添加 Anthropic 渠道**

| 字段 | 值 |
|------|---|
| 类型 | Anthropic Claude |
| 名称 | Claude-主力 |
| 分组 | 主力渠道 |
| 模型 | claude-sonnet-4-20250514, claude-haiku-4-5-20251001 |
| 密钥 | `sk-ant-xxx`（你的 Claude Key） |
| 优先级 | 10 |

**Step 3: 添加 Gemini 渠道**

| 字段 | 值 |
|------|---|
| 类型 | Google Gemini |
| 名称 | Gemini-主力 |
| 分组 | 主力渠道 |
| 模型 | gemini-2.5-pro, gemini-2.5-flash |
| 密钥 | `AIzaxxx`（你的 Gemini Key） |
| 优先级 | 10 |

**Step 4: 添加备用渠道（OpenAI + DeepSeek 各一个备用 Key，优先级设为 5）**

**Step 5: 逐个测试所有渠道**

Expected: 所有渠道测试通过。

---

### Task 4.5: 配置模型计费倍率

后台 → 系统设置 → 运营设置 → 模型倍率：

| 模型 | 倍率 |
|------|------|
| gpt-4o | 1.8 |
| gpt-4o-mini | 2.0 |
| claude-sonnet-4-* | 1.8 |
| claude-haiku-4-5-* | 2.0 |
| deepseek-chat | 1.5 |
| deepseek-reasoner | 1.5 |
| gemini-2.5-pro | 1.8 |
| gemini-2.5-flash | 2.0 |
| qwen-max | 1.5 |
| glm-4-plus | 1.5 |

---

### Task 4.6: 创建测试令牌并验证

**Step 1: 创建令牌**

后台 → 令牌管理 → 新建：

| 字段 | 值 |
|------|---|
| 名称 | 测试令牌 |
| 额度 | 100000 |
| 过期时间 | 30天 |

**Step 2: 测试非流式调用**

```bash
curl https://api.yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <测试令牌>" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"你好"}]}'
```

Expected: 返回 JSON 响应，包含模型回复。

**Step 3: 测试流式调用**

```bash
curl https://api.yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <测试令牌>" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}],"stream":true}'
```

Expected: 返回 `data: {...}` 格式的 SSE 流式响应，逐块输出。

**Step 4: 验证日志记录**

后台 → 日志 → 查看最新两条记录，确认"请求内容"和"响应内容"列有数据。

---

## Phase 5: 监控面板配置

### Task 5.1: 配置 Grafana 数据源

**Step 1: 登录 Grafana**

浏览器打开 `https://api.yourdomain.com/grafana/`
账号: `admin` / 密码: `.env` 中的 `GRAFANA_PASSWORD`

**Step 2: 添加 Prometheus 数据源**

左侧菜单 → Connections → Data Sources → Add data source → Prometheus

| 字段 | 值 |
|------|---|
| URL | `http://prometheus:9090` |
| Access | Server |

点击 "Save & Test"。

Expected: 显示 "Data source is working"。

---

### Task 5.2: 导入监控面板

**Step 1: 搜索社区面板**

左侧菜单 → Dashboards → Import

在 Grafana 社区搜索 `New-API` 或 `One-API` 面板模板，获取面板 ID。

**Step 2: 如无现成面板，手动创建核心面板**

创建 Dashboard，添加以下 Panel：

| Panel 名称 | 类型 | PromQL 查询 |
|------------|------|-------------|
| 请求 QPS | Time series | `rate(http_requests_total[5m])` |
| 请求延迟 P95 | Time series | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |
| CPU 使用率 | Gauge | `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)` |
| 内存使用率 | Gauge | `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100` |
| 磁盘使用率 | Gauge | `(1 - node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100` |

> 注意: 具体的 metrics 名称取决于 New-API 暴露的 Prometheus 指标。首次配置时先到 `http://prometheus:9090/targets` 确认 new-api 和 node-exporter 两个 job 状态为 UP。

**Step 3: 保存 Dashboard**

---

## Phase 6: 备份与安全加固

### Task 6.1: 配置自动备份

**Step 1: 创建 MySQL 凭据文件**

```bash
# 从 .env 读取密码
source /home/deploy/new-api/.env
docker exec mysql bash -c "cat > /var/lib/mysql/.my.cnf <<EOF
[mysqldump]
user=root
password=${MYSQL_ROOT_PASSWORD}
EOF
chmod 600 /var/lib/mysql/.my.cnf"
```

**Step 2: 创建备份脚本**

```bash
cat > /home/deploy/new-api/scripts/backup.sh <<'SCRIPT'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/home/deploy/backups
mkdir -p $BACKUP_DIR

# 备份数据库
docker exec mysql mysqldump \
  --defaults-extra-file=/var/lib/mysql/.my.cnf \
  --databases new-api new-api-log \
  | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 备份配置
tar czf $BACKUP_DIR/config_$DATE.tar.gz \
  -C /home/deploy/new-api \
  docker-compose.yml .env config/

# 清理旧备份
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +90 -delete

echo "[$(date)] Backup completed: db_$DATE.sql.gz"
SCRIPT
chmod +x /home/deploy/new-api/scripts/backup.sh
```

**Step 3: 测试备份**

```bash
/home/deploy/new-api/scripts/backup.sh
ls -lh /home/deploy/backups/
```

Expected: 生成 `db_*.sql.gz` 和 `config_*.tar.gz` 两个文件。

**Step 4: 设置定时任务**

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * /home/deploy/new-api/scripts/backup.sh >> /var/log/backup.log 2>&1") | crontab -
```

**Step 5: 验证 cron**

```bash
crontab -l
```

Expected: 显示凌晨 3 点的备份任务。

---

### Task 6.2: SSH 安全加固（海外节点）

**Step 1: 修改 SSH 端口（可选但推荐）**

```bash
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config
sudo ufw allow 2222/tcp
sudo systemctl restart sshd
```

> 修改后用新端口连接: `ssh -p 2222 deploy@<IP>`

**Step 2: 禁用 root 密码登录**

```bash
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd
```

> **警告**：执行前确保 SSH Key 登录已测试成功！

**Step 3: 验证 fail2ban 运行**

```bash
sudo systemctl status fail2ban
sudo fail2ban-client status sshd
```

Expected: fail2ban 处于 active 状态。

---

### Task 6.3: 配置 .env 权限

```bash
chmod 600 /home/deploy/new-api/.env
```

验证:

```bash
ls -la /home/deploy/new-api/.env
```

Expected: 权限为 `-rw-------`。

---

## Phase 7: 上线验证

### Task 7.1: 执行上线检查清单

逐项检查以下内容：

```bash
# 1. 海外节点容器状态
ssh deploy@<海外节点IP> "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# 2. 国内节点 Nginx 状态
ssh root@<国内节点IP> "systemctl status nginx --no-pager"

# 3. HTTPS 访问
curl -o /dev/null -s -w "%{http_code}" https://api.yourdomain.com

# 4. API 调用测试
curl -s https://api.yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <令牌>" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"测试"}]}' | head -c 200

# 5. SSE 流式测试
curl -N https://api.yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <令牌>" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hi"}],"stream":true}' 2>&1 | head -5

# 6. Grafana 访问
curl -o /dev/null -s -w "%{http_code}" https://api.yourdomain.com/grafana/login

# 7. 备份文件存在
ssh deploy@<海外节点IP> "ls -la /home/deploy/backups/"
```

Expected: 所有检查通过。

---

### Task 7.2: 生成首批兑换码

后台 → 兑换管理 → 批量生成：

| 面额 | 数量 |
|------|------|
| $1 (100000额度) | 20个 |
| $5 (500000额度) | 10个 |
| $20 (2000000额度) | 5个 |

导出兑换码列表，保存到安全位置。

---

### Task 7.3: 正式上线

1. 确认所有检查通过
2. DNS 已指向国内节点（备案通过后）
3. 修改管理员默认密码为强密码
4. 开始邀请用户注册使用

---

## 任务总览

| Phase | 任务数 | 预估时间 | 前置依赖 |
|-------|--------|---------|---------|
| Phase 0: 采购注册 | 6 | 1-14天（备案最久） | 无 |
| Phase 1: 海外系统初始化 | 5 | 30分钟 | Task 0.3 |
| Phase 2: 海外服务部署 | 8 | 45分钟 | Phase 1 |
| Phase 3: 国内代理节点 | 3 | 20分钟 | Task 0.4 + 备案 |
| Phase 4: 后台配置 | 6 | 30分钟 | Phase 2 + Task 0.5/0.6 |
| Phase 5: 监控面板 | 2 | 15分钟 | Phase 2 |
| Phase 6: 备份安全 | 3 | 15分钟 | Phase 2 |
| Phase 7: 上线验证 | 3 | 15分钟 | 全部 |

**总计: 36 个任务，技术操作约 2.5 小时（不含采购等待时间）**
