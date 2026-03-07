# New-API AI 中转站完整部署方案

> 版本: v1.0 | 日期: 2026-03-07 | 架构: 双节点分体

## 一、项目概述

### 目标

搭建基于 New-API 的小型 AI API 中转站，面向 20-100 名付费用户运营。

### 需求汇总

| 维度 | 选择 |
|------|------|
| 核心系统 | New-API (QuantumNous/new-api) |
| 服务对象 | 小型付费运营（20-100人） |
| 模型范围 | 海外+国产混合 (OpenAI/Claude/Gemini + DeepSeek/通义/智谱) |
| 部署架构 | 国内+海外双节点 (方案A) |
| 月预算 | $20-50（不含 API 调用费） |
| 收费方式 | 充值额度制 |
| 数据收集 | 可视化报表 + 请求/响应内容日志 |

---

## 二、架构设计

### 架构总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户请求流                                   │
│                                                                     │
│  国内用户 ──HTTPS──→ 国内节点(腾讯云轻量/Nginx)                       │
│                        ├── SSL 终结                                  │
│                        ├── Gzip 压缩                                 │
│                        └── proxy_pass ──→ 海外节点(RackNerd/新加坡)   │
│                                              │                      │
│                              New-API(:3000)   │                      │
│                                    ┌─────────┼─────────┐            │
│                                    ↓         ↓         ↓            │
│                                 MySQL     Redis    Grafana           │
│                               (主库+日志库) (缓存)  (:3001)           │
│                                    │                                 │
│                          ┌─────────┼─────────────┐                   │
│                          ↓         ↓             ↓                   │
│                      海外 API    国产 API      其他 API               │
│                   (OpenAI等)   (DeepSeek等)   (Gemini等)             │
└─────────────────────────────────────────────────────────────────────┘
```

### 设计要点

- **数据库端口不暴露公网** — 仅通过 Docker 内部网络通信
- **密码统一用 `.env` 管理** — 不硬编码到任何配置文件
- **全部容器化** — Nginx 也在 Docker 内，`docker compose` 一键管理
- **healthcheck** — MySQL/Redis 健康检查确保依赖就绪后再启动 New-API
- **日志分库** — 请求/响应内容独立数据库，不影响主库性能

---

## 三、服务器选型

### 海外主节点

| 项目 | 选择 |
|------|------|
| 服务商 | **RackNerd** |
| 位置 | 新加坡 |
| 配置 | 2核4G, 60GB SSD, 2TB流量 |
| 费用 | $6-20/月（年付更划算） |
| 系统 | Ubuntu 22.04 LTS |

### 国内代理节点

| 项目 | 选择 |
|------|------|
| 服务商 | **腾讯云轻量应用服务器** |
| 位置 | 上海/广州 |
| 配置 | 1核1G, 20GB SSD, 3Mbps |
| 费用 | ¥40/月（活动价更低） |
| 系统 | Ubuntu 22.04 LTS |
| 注意 | 使用 80/443 端口需备案 |

### 域名

| 项目 | 选择 |
|------|------|
| 注册商 | **阿里云万网** |
| 费用 | ¥69/年 (.com) |
| 优势 | 备案流程最快最顺畅 |

### 月成本估算

| 项目 | 费用 |
|------|------|
| RackNerd 海外节点 | ~$10/月 |
| 腾讯云国内节点 | ~$5/月 (¥40) |
| 域名分摊 | ~$1/月 |
| **合计（不含API费）** | **~$16/月** |

---

## 四、API Key 购买指南

### 海外模型

| 厂商 | 注册地址 | 注册要求 | 支付方式 | 免费额度 | 定价 (input/output per 1M tokens) |
|------|---------|---------|---------|---------|------|
| OpenAI | platform.openai.com | 海外手机号+海外IP | 海外信用卡 | 无 | GPT-4o: $2.5/$10, 4o-mini: $0.15/$0.6 |
| Anthropic | console.anthropic.com | 海外手机号+海外IP | 海外信用卡 | $5试用 | Sonnet 4: $3/$15, Haiku 3.5: $0.8/$4 |
| Google Gemini | aistudio.google.com | Google 账号即可 | Google Pay/信用卡 | 免费有限RPM | 2.5 Pro: $1.25/$10, Flash: $0.15/$0.6 |

### 国产模型

| 厂商 | 注册地址 | 注册要求 | 支付方式 | 免费额度 | 定价 (per 1M tokens) |
|------|---------|---------|---------|---------|------|
| DeepSeek | platform.deepseek.com | 国内手机号 | 支付宝/微信 | ¥10体验金 | V3: ¥1/¥2, R1: ¥4/¥16 |
| 通义千问 | dashscope.console.aliyun.com | 阿里云账号 | 支付宝 | 100万tokens | Qwen-Max: ¥2/¥6 |
| 智谱 GLM | open.bigmodel.cn | 国内手机号 | 支付宝/微信 | 500万tokens | GLM-4-Plus: ¥50/¥50 |

### 海外手机号与信用卡解决方案

**手机号：**

| 方案 | 成本 | 说明 |
|------|------|------|
| 接码平台 (SMS-Activate) | $1-3/次 | 一次性验证，最便宜 |
| Google Voice | 免费 | 需美区 Google 账号，获取难度增加 |
| 实体 SIM 卡 (giffgaff/Ultra Mobile) | $5-15 | 最可靠，可长期接收验证码 |

**信用卡：**

| 方案 | 成本 | 说明 |
|------|------|------|
| 虚拟信用卡 (WildCard/Dupay) | 开卡$10-15, 月费$1-2 | 最主流，支持支付宝充值 |
| 实体海外卡 (中银香港/汇丰) | 需线下开户 | 最正规但门槛最高 |

### API 成本估算

| 场景 | 月调用量 | 主要模型 | 月API成本 |
|------|---------|---------|----------|
| 轻度 | 1500次/月 | 4o-mini + DeepSeek | $5-15 |
| 中度 | 5000次/月 | 4o + Claude + DeepSeek | $30-80 |
| 重度 | 15000次/月 | 混合各模型 | $100-300 |

---

## 五、海外主节点部署

### 5.1 系统初始化

```bash
# 连接服务器
ssh root@<海外节点IP>

# 更新系统
apt update && apt upgrade -y

# 创建运维用户（不使用 root 运行服务）
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# 安装必要工具
apt install -y curl wget git vim ufw htop

# 配置防火墙（仅开放必要端口）
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 配置 SSH Key 登录后禁用密码登录
# （先确保 SSH Key 已配置，再修改 /etc/ssh/sshd_config）
```

### 5.2 安装 Docker

```bash
# 使用官方仓库安装（比 curl|sh 更安全）
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 配置日志轮转（防止磁盘写满）
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# 验证
docker --version
docker compose version
```

### 5.3 创建项目目录

```bash
su - deploy
mkdir -p /home/deploy/new-api/{config/nginx/conf.d,config/nginx/ssl,config/prometheus,data}
cd /home/deploy/new-api
```

### 5.4 Docker Compose 配置

`docker-compose.yml`：

```yaml
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
```

### 5.5 环境变量

`.env`：

```bash
MYSQL_ROOT_PASSWORD=<随机生成16位强密码>
REDIS_PASSWORD=<随机生成16位强密码>
SESSION_SECRET=<随机生成32位字符串>
GRAFANA_PASSWORD=<Grafana管理密码>
DOMAIN=api.yourdomain.com
```

生成随机密码：

```bash
# MySQL 密码
openssl rand -base64 16
# Redis 密码
openssl rand -base64 16
# Session Secret
openssl rand -hex 16
```

### 5.6 MySQL 初始化脚本

`config/mysql-init/init.sql`：

```sql
CREATE DATABASE IF NOT EXISTS `new-api-log` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5.7 Prometheus 配置

`config/prometheus/prometheus.yml`：

```yaml
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
```

### 5.8 Nginx 配置（海外节点）

`config/nginx/nginx.conf`：

```nginx
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
```

`config/nginx/conf.d/default.conf`：

```nginx
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

    # 安全头
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # New-API
    location / {
        proxy_pass http://new-api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式响应
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    # Grafana（仅管理员访问）
    location /grafana/ {
        proxy_pass http://grafana:3000/grafana/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.9 SSL 证书

在海外节点宿主机安装 Certbot 生成证书，然后挂载到容器：

```bash
# 先停止 nginx 容器释放 80 端口
docker compose stop nginx

# 安装 certbot 并申请证书
apt install -y certbot
certbot certonly --standalone -d api.yourdomain.com

# 复制证书到项目目录
cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem /home/deploy/new-api/config/nginx/ssl/
cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem /home/deploy/new-api/config/nginx/ssl/

# 重启 nginx
docker compose start nginx

# 设置自动续期 cron
echo "0 3 1 * * certbot renew --pre-hook 'docker compose -f /home/deploy/new-api/docker-compose.yml stop nginx' --post-hook 'cp /etc/letsencrypt/live/api.yourdomain.com/*.pem /home/deploy/new-api/config/nginx/ssl/ && docker compose -f /home/deploy/new-api/docker-compose.yml start nginx'" | crontab -
```

### 5.10 启动服务

```bash
cd /home/deploy/new-api
docker compose up -d

# 检查所有容器状态
docker ps

# 查看 New-API 日志确认启动
docker logs -f new-api
```

---

## 六、国内代理节点部署

### 6.1 系统初始化

```bash
ssh root@<国内节点IP>

apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx ufw

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 6.2 Nginx 反向代理配置

`/etc/nginx/sites-available/api-proxy.conf`：

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    # 安全头
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

        # SSE 流式响应
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    # Grafana（管理员访问）
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
```

### 6.3 启用配置

```bash
ln -s /etc/nginx/sites-available/api-proxy.conf /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# SSL 证书（域名已备案并解析到国内节点后）
certbot --nginx -d api.yourdomain.com

# 自动续期
certbot renew --dry-run
```

### 6.4 DNS 配置

在阿里云万网 DNS 控制台：

```
api.yourdomain.com  →  A 记录  →  国内腾讯云节点 IP
```

---

## 七、API 路由配置与渠道管理

### 7.1 初始化

首次访问 `https://api.yourdomain.com` 注册的账号即为管理员。

### 7.2 渠道分组规划

```
渠道分组: "主力渠道"
  ├── 渠道1: OpenAI (GPT-4o, GPT-4o-mini)
  ├── 渠道2: Anthropic (Claude Sonnet 4, Haiku 3.5)
  ├── 渠道3: Google Gemini (Gemini 2.5 Pro, Flash)
  ├── 渠道4: DeepSeek (V3, R1)
  ├── 渠道5: 通义千问 (Qwen-Max, Qwen-Plus)
  └── 渠道6: 智谱 (GLM-4-Plus)

渠道分组: "备用渠道"
  ├── 渠道7: OpenAI 备用 Key
  └── 渠道8: DeepSeek 备用 Key
```

### 7.3 渠道类型对应表

| 厂商 | New-API 渠道类型 | Base URL (留空=默认) | 格式支持 |
|------|-----------------|---------------------|---------|
| OpenAI | OpenAI | 默认 | OpenAI 原生 |
| Anthropic | Anthropic Claude | 默认 | 自动转换 OpenAI ⇄ Claude |
| Google Gemini | Google Gemini | 默认 | 自动转换 OpenAI → Gemini |
| DeepSeek | OpenAI (兼容) | `https://api.deepseek.com` | OpenAI 兼容 |
| 通义千问 | 阿里云DashScope | 默认 | 自动转换 |
| 智谱 GLM | 智谱 ChatGLM | 默认 | 自动转换 |

### 7.4 路由优先级

```
用户请求 model:"gpt-4o"
  → 查找所有包含 gpt-4o 的已启用渠道
  → 按优先级排序（数字越大越优先）
  → 同优先级渠道间负载均衡
  → 失败自动 fallback 到下一个
```

| 渠道 | 优先级 |
|------|--------|
| 主力渠道 | 10 |
| 备用渠道 | 5 |

### 7.5 模型计费倍率

| 模型 | 官方成本 (input/1M) | 倍率 | 售价 |
|------|---------------------|------|------|
| gpt-4o | $2.50 | 1.8x | $4.50 |
| gpt-4o-mini | $0.15 | 2.0x | $0.30 |
| claude-sonnet-4 | $3.00 | 1.8x | $5.40 |
| deepseek-chat | ¥1.00 | 1.5x | ¥1.50 |
| gemini-2.5-flash | $0.15 | 2.0x | $0.30 |

> 低价模型倍率设高（2x），高价模型倍率适度（1.5-1.8x）。

### 7.6 API 调用验证

```bash
curl https://api.yourdomain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <你创建的令牌>" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

---

## 八、用户运营与收费体系

### 8.1 用户分级

| 等级 | 名称 | 获取方式 | 可用模型 | RPM | 额度倍率 |
|------|------|---------|---------|-----|---------|
| 1 | 免费体验 | 注册即得 | gpt-4o-mini, deepseek-chat | 10 | 1x |
| 2 | 基础用户 | 首次充值 | 全部模型 | 30 | 1x |
| 3 | 高级用户 | 累计充值≥$50 | 全部模型 | 60 | 0.9x |

### 8.2 注册配置

| 配置项 | 值 |
|--------|---|
| 开放注册 | 启用 |
| 邮箱验证 | 启用 |
| 新用户初始额度 | $0.5 |
| 签到奖励 | $0.05/天 |

### 8.3 充值方式

**起步阶段：兑换码**

```
用户微信联系 → 支付宝/微信转账 → 发送兑换码 → 用户前台兑换 → 额度到账
```

建议生成兑换码面额：$1 / $5 / $20。

**扩展阶段：在线支付**

接入易支付或虎皮椒，支持支付宝/微信自助充值（手续费 1%-3%）。

### 8.4 安全限制

| 限制类型 | 建议值 |
|---------|--------|
| 全局 RPM | 60/分钟 |
| 单令牌 RPM | 30/分钟 |

---

## 九、监控与数据收集

### 9.1 三层数据架构

```
第1层: New-API 内置  → 额度、调用次数、Token用量、渠道状态
第2层: Prometheus    → 请求延迟、错误率、QPS、系统资源
第3层: Grafana       → 整合可视化面板
```

### 9.2 New-API 内置统计

| 数据 | 位置 |
|------|------|
| 用户消费排行 | 后台 → 用户管理 |
| 模型调用统计 | 后台 → 日志 → 统计 |
| 渠道消费统计 | 后台 → 渠道管理 |
| 请求详细日志 | 后台 → 日志 |

### 9.3 请求/响应内容记录

后台 → **系统设置** → **日志设置**：

| 配置项 | 设置 |
|--------|------|
| 记录请求内容 | 启用 |
| 记录响应内容 | 启用 |

日志数据存储在独立数据库 `new-api-log`，与主库分离：

| 影响 | 应对 |
|------|------|
| 存储膨胀（月均 5-75GB） | 设置日志保留 30-60 天 |
| 数据库压力 | 日志独立数据库 + 按月分表 |
| 隐私合规 | 服务条款中声明数据收集范围 |

### 9.4 Grafana 面板

访问 `https://api.yourdomain.com/grafana/`。

推荐面板：

| 面板 | 数据源 | 展示内容 |
|------|--------|---------|
| API 概览 | Prometheus | QPS、平均延迟、错误率 |
| 模型分布 | Prometheus | 各模型调用占比、Token趋势 |
| 成本分析 | Prometheus | 每日API成本、收入、毛利润 |
| 系统健康 | Node Exporter | CPU、内存、磁盘、带宽 |

### 9.5 日志保留策略

| 数据 | 保留 |
|------|------|
| API 请求日志（含内容） | 60 天 |
| Prometheus 指标 | 30 天 |
| Docker 容器日志 | 50MB×3 轮转 |
| Grafana 配置 | 永久 |

---

## 十、备份与运维

### 10.1 自动备份脚本

`/home/deploy/new-api/scripts/backup.sh`：

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/home/deploy/backups
mkdir -p $BACKUP_DIR

# 备份数据库（使用 --defaults-extra-file 避免密码泄露）
docker exec mysql mysqldump \
  --defaults-extra-file=/var/lib/mysql/.my.cnf \
  --databases new-api new-api-log \
  | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# 备份配置文件
tar czf $BACKUP_DIR/config_$DATE.tar.gz \
  -C /home/deploy/new-api \
  docker-compose.yml .env config/

# 清理：数据库备份保留30天，配置备份保留90天
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +90 -delete

echo "[$(date)] Backup completed: db_$DATE.sql.gz"
```

```bash
chmod +x /home/deploy/new-api/scripts/backup.sh
# 每天凌晨3点执行
(crontab -l; echo "0 3 * * * /home/deploy/new-api/scripts/backup.sh >> /var/log/backup.log 2>&1") | crontab -
```

### 10.2 恢复流程

```bash
# 解压数据库备份
gunzip $BACKUP_DIR/db_YYYYMMDD_HHMM.sql.gz

# 恢复数据库
docker exec -i mysql mysql -uroot -p < $BACKUP_DIR/db_YYYYMMDD_HHMM.sql

# 恢复配置
tar xzf $BACKUP_DIR/config_YYYYMMDD_HHMM.tar.gz -C /home/deploy/new-api/

# 重启服务
cd /home/deploy/new-api && docker compose restart
```

### 10.3 升级流程

```bash
cd /home/deploy/new-api

# 1. 先备份
./scripts/backup.sh

# 2. 拉取新镜像
docker compose pull

# 3. 重启
docker compose up -d

# 4. 验证
docker logs -f --tail 50 new-api

# 5. 如失败则回滚
# docker compose down
# docker image tag calciumion/new-api:<旧版本> calciumion/new-api:latest
# docker compose up -d
```

### 10.4 安全加固

| 项目 | 措施 |
|------|------|
| SSH | Key 登录，禁用密码，改端口，安装 fail2ban |
| 数据库 | 端口不暴露公网，强密码，Docker 内网访问 |
| Nginx | 安全头 (HSTS/X-Frame/X-Content-Type) |
| .env | 权限 600，不入版本控制 |
| 防火墙 | 仅开放 22/80/443 |

---

## 十一、上线检查清单

| # | 检查项 | 状态 |
|---|--------|------|
| 1 | RackNerd 服务器已租用 (新加坡) | [ ] |
| 2 | 腾讯云轻量已租用 | [ ] |
| 3 | 域名已注册 + 备案完成 | [ ] |
| 4 | 海外节点 Docker 环境就绪 | [ ] |
| 5 | docker compose up -d 所有容器正常 | [ ] |
| 6 | SSL 证书配置完成 (两个节点) | [ ] |
| 7 | DNS A 记录指向国内节点 | [ ] |
| 8 | 国内节点 Nginx 反向代理正常 | [ ] |
| 9 | HTTPS 访问 New-API 前台正常 | [ ] |
| 10 | 管理员账号已创建 | [ ] |
| 11 | 至少 1 个渠道已配置并测试通过 | [ ] |
| 12 | curl 测试 API 调用返回正常 | [ ] |
| 13 | 流式响应 (SSE) 正常工作 | [ ] |
| 14 | Grafana 面板可访问 | [ ] |
| 15 | 请求/响应日志记录已开启 | [ ] |
| 16 | 备份脚本 + cron 已配置 | [ ] |
| 17 | 防火墙仅开放 22/80/443 | [ ] |
| 18 | fail2ban 已安装 | [ ] |
