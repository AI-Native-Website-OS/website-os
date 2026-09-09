-- ============================================================
-- 圣诺联合官网 - PostgreSQL 数据库初始化脚本
-- 数据库: sinounion
-- 说明: 系统启动时自动执行，若数据库/表/管理员不存在则创建
-- ============================================================


CREATE EXTENSION vector;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- ============================================================
-- 一、表结构定义
-- ============================================================

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    real_name VARCHAR(50),
    company_name VARCHAR(200),
    avatar VARCHAR(255),
    status SMALLINT DEFAULT 1,
    role VARCHAR(30) ,
    user_type VARCHAR(20) DEFAULT 'EXTERNAL',
    department VARCHAR(100),
    last_login_time TIMESTAMP,
    token_version INTEGER DEFAULT 0 NOT NULL,
    deleted SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 兼容: 为已存在的表添加 token_version 列
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0 NOT NULL;

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.company_name IS '公司名称';
COMMENT ON COLUMN users.status IS '1=启用 0=禁用';
COMMENT ON COLUMN users.role IS '角色: SUPER_ADMIN(超级管理员-内部用户)/NORMAL_USER(普通用户-外部用户)';
COMMENT ON COLUMN users.user_type IS '用户类型: INTERNAL(内部用户)/EXTERNAL(外部用户)';

-- 2. 权限表
CREATE TABLE IF NOT EXISTS permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    module VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE permissions IS '权限定义表';
COMMENT ON COLUMN permissions.code IS '权限编码';
COMMENT ON COLUMN permissions.name IS '权限名称';
COMMENT ON COLUMN permissions.module IS '所属模块';

-- 3. 角色权限映射表
CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role VARCHAR(30) NOT NULL,
    permission_id BIGINT NOT NULL,
    CONSTRAINT uk_role_perm UNIQUE (role, permission_id)
);

COMMENT ON TABLE role_permissions IS '角色权限映射表';
COMMENT ON COLUMN role_permissions.role IS '角色编码';

-- 3.5 角色定义表
CREATE TABLE IF NOT EXISTS roles (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE roles IS '角色定义表';
COMMENT ON COLUMN roles.code IS '角色编码';
COMMENT ON COLUMN roles.name IS '角色显示名称';
COMMENT ON COLUMN roles.description IS '角色描述';


-- 产品线/行业表已统一至 content_categories（module_key=products/solutions）

-- 产品/解决方案/方案产品关联表已统一至 content_items（module_key=products/solutions）

-- 核心模块表
CREATE TABLE IF NOT EXISTS core_modules (
    id BIGSERIAL PRIMARY KEY,
    module_key VARCHAR(50) NOT NULL UNIQUE,
    module_name VARCHAR(50) NOT NULL,
    module_title VARCHAR(100),
    module_description VARCHAR(500),
    module_type SMALLINT DEFAULT 1,
    is_system SMALLINT DEFAULT 0,
    path VARCHAR(100),
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    module_columns INT DEFAULT 4,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted SMALLINT DEFAULT 0
);

-- 兼容: 为已存在的表添加 module_columns 列
ALTER TABLE core_modules ADD COLUMN IF NOT EXISTS module_columns INT DEFAULT 4;

DROP TRIGGER IF EXISTS trg_core_modules_updated_at ON core_modules;
CREATE TRIGGER trg_core_modules_updated_at BEFORE UPDATE ON core_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE core_modules IS '核心模块表';
COMMENT ON COLUMN core_modules.module_key IS '模块唯一标识(products/solutions/cases/resources 或自定义)';
COMMENT ON COLUMN core_modules.module_type IS '模块类型(1=双层嵌套 2=单层)';
COMMENT ON COLUMN core_modules.path IS '模块页面路径(自定义模块跳转用)';
COMMENT ON COLUMN core_modules.status IS '1=启用 0=禁用';
COMMENT ON COLUMN core_modules.module_columns IS '首页模块展示列数(默认4)';

INSERT INTO core_modules (module_key, module_name, module_title, module_description, module_type, is_system, path, sort_order, status) VALUES
('demo-product',   '演示产品',   '演示模块', '这是一条示例种子数据，用于演示产品类自定义模块', 1, 0, '/demo-product', 0, 1),
('demo-solution',  '演示方案', '演示模块', '这是一条示例种子数据，用于演示解决方案类自定义模块', 2, 0, '/demo-solution', 1, 1)
ON CONFLICT (module_key) DO NOTHING;

-- 内容分类表（双层嵌套自定义模块）
CREATE TABLE IF NOT EXISTS content_categories (
    id BIGSERIAL PRIMARY KEY,
    module_key VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100),
    description VARCHAR(500),
    cover_image VARCHAR(255),
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted SMALLINT DEFAULT 0,
    CONSTRAINT uk_content_category_module_slug UNIQUE (module_key, slug)
);

DROP TRIGGER IF EXISTS trg_content_categories_updated_at ON content_categories;
CREATE TRIGGER trg_content_categories_updated_at BEFORE UPDATE ON content_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE content_categories IS '内容分类表（双层嵌套自定义模块）';
COMMENT ON COLUMN content_categories.module_key IS '关联核心模块标识';
COMMENT ON COLUMN content_categories.name IS '分类名称';
COMMENT ON COLUMN content_categories.status IS '1=启用 0=禁用';

-- 通用内容表（所有核心模块，含内置产品/方案/案例/资源）
CREATE TABLE IF NOT EXISTS content_items (
    id BIGSERIAL PRIMARY KEY,
    module_key VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    category_id BIGINT,
    group_name VARCHAR(100),
    summary TEXT,
    content TEXT,
    cover_image VARCHAR(255),
    file_path VARCHAR(255),
    file_name VARCHAR(255),
    file_size BIGINT,
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    is_top INT DEFAULT 0,
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    author VARCHAR(100),
    source VARCHAR(100),
    download_count INT DEFAULT 0,
    require_form INT DEFAULT 0,
    seo_title VARCHAR(200),
    seo_description VARCHAR(500),
    view_count INT DEFAULT 0,
    extra_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted SMALLINT DEFAULT 0,
    CONSTRAINT uk_content_module_slug UNIQUE (module_key, slug)
);

DROP TRIGGER IF EXISTS trg_content_items_updated_at ON content_items;
CREATE TRIGGER trg_content_items_updated_at BEFORE UPDATE ON content_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE content_items IS '通用内容表（所有核心模块，含内置产品/方案/案例/资源）';
COMMENT ON COLUMN content_items.module_key IS '关联核心模块标识';
COMMENT ON COLUMN content_items.category_id IS '关联内容分类';
COMMENT ON COLUMN content_items.group_name IS '分组（单层模块筛选，兼容旧数据）';
COMMENT ON COLUMN content_items.slug IS '内容唯一标识';
COMMENT ON COLUMN content_items.status IS '1=启用 0=禁用';
COMMENT ON COLUMN content_items.is_top IS '1=置顶';
COMMENT ON COLUMN content_items.scheduled_at IS '定时发布时间';
COMMENT ON COLUMN content_items.published_at IS '实际发布时间';
COMMENT ON COLUMN content_items.extra_data IS '扩展JSON(展示区块sections/关联内容relations等)';

-- 首页区块表
CREATE TABLE IF NOT EXISTS home_sections (
    id BIGSERIAL PRIMARY KEY,
    section_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) UNIQUE,
    subtitle VARCHAR(200),
    description TEXT,
    image VARCHAR(255),
    url VARCHAR(500),
    extra_data TEXT,
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_home_sections_updated_at ON home_sections;
CREATE TRIGGER trg_home_sections_updated_at BEFORE UPDATE ON home_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE home_sections IS '首页区块表';
COMMENT ON COLUMN home_sections.section_type IS '区块类型(painPoint等)';
COMMENT ON COLUMN home_sections.extra_data IS '扩展JSON数据';
COMMENT ON COLUMN home_sections.status IS '1=显示 0=隐藏';

-- 关于页面区块表
CREATE TABLE IF NOT EXISTS about_sections (
    id BIGSERIAL PRIMARY KEY,
    section_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) UNIQUE,
    subtitle VARCHAR(200),
    description TEXT,
    image VARCHAR(255),
    extra_data TEXT,
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_about_sections_updated_at ON about_sections;
CREATE TRIGGER trg_about_sections_updated_at BEFORE UPDATE ON about_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE about_sections IS '关于页面区块表';
COMMENT ON COLUMN about_sections.section_type IS '区块类型(description/culture/milestone/contact)';
COMMENT ON COLUMN about_sections.extra_data IS '扩展JSON数据';
COMMENT ON COLUMN about_sections.status IS '1=显示 0=隐藏';

-- 8. 案例表（已统一至 content_items，module_key=cases）
-- 9. 资源表（已统一至 content_items，module_key=resources）

-- 10. FAQ表
CREATE TABLE IF NOT EXISTS faqs (
    id BIGSERIAL PRIMARY KEY,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    product_id BIGINT,
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted SMALLINT DEFAULT 0
);

COMMENT ON TABLE faqs IS 'FAQ表';
COMMENT ON COLUMN faqs.product_id IS '关联内容条目(content_items.id, 产品模块)';

-- 12. 资源分类（已统一至 content_categories，module_key=resources）

-- 13. 线索表
CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100),
    company VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    source VARCHAR(50),
    source_page VARCHAR(255),
    ip_address VARCHAR(50),
    country VARCHAR(100),
    province VARCHAR(100),
    city VARCHAR(100),
    interest_area VARCHAR(200),
    requirement TEXT,
    enterprise_type VARCHAR(100),
    business_direction VARCHAR(100),
    project_requirement TEXT,
    project_timeline VARCHAR(100),
    score INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'new',
    assigned_to BIGINT,
    follow_up_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE leads IS '线索表';
COMMENT ON COLUMN leads.source IS 'form/ai_chat/whitepaper/registration/page_click/cta-form/solution/demo-booking';
COMMENT ON COLUMN leads.ip_address IS '客户端 IP';
COMMENT ON COLUMN leads.country IS 'IP 归属国家';
COMMENT ON COLUMN leads.province IS 'IP 归属省份';
COMMENT ON COLUMN leads.city IS 'IP 归属城市';
COMMENT ON COLUMN leads.interest_area IS '关注方向';
COMMENT ON COLUMN leads.requirement IS '需求描述';
COMMENT ON COLUMN leads.enterprise_type IS '企业类型';
COMMENT ON COLUMN leads.business_direction IS '业务方向';
COMMENT ON COLUMN leads.project_requirement IS '项目需求';
COMMENT ON COLUMN leads.project_timeline IS '项目时间';
COMMENT ON COLUMN leads.score IS '线索评分';
COMMENT ON COLUMN leads.status IS 'new/contacted/qualified/quoted/closed/invalid';
COMMENT ON COLUMN leads.assigned_to IS '分配销售';

-- 14. 线索跟进记录表
CREATE TABLE IF NOT EXISTS lead_activities (
    id BIGSERIAL PRIMARY KEY,
    lead_id BIGINT NOT NULL,
    activity_type VARCHAR(50),
    content TEXT,
    operator_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE lead_activities IS '线索跟进记录表';

-- 15. 联系表单提交表
CREATE TABLE IF NOT EXISTS contact_submissions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100),
    company VARCHAR(200),
    phone VARCHAR(20),
    email VARCHAR(100),
    subject VARCHAR(200),
    message TEXT,
    source_page VARCHAR(255),
    lead_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE contact_submissions IS '联系表单提交表';

-- 16. Banner表
CREATE TABLE IF NOT EXISTS banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200),
    subtitle VARCHAR(200),
    image VARCHAR(255),
    link_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE banners IS 'Banner表';

-- 17. 合作伙伴表
CREATE TABLE IF NOT EXISTS partners (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo VARCHAR(255),
    website_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE partners IS '合作伙伴表';

-- 18. 产业图谱表
CREATE TABLE IF NOT EXISTS industry_chains (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT,
    icon VARCHAR(50),
    description VARCHAR(500),
    link_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    status INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE industry_chains IS '产业图谱表';

-- 22. SEO配置表
CREATE TABLE IF NOT EXISTS seo_configs (
    id BIGSERIAL PRIMARY KEY,
    page_type VARCHAR(50),
    page_id BIGINT,
    title VARCHAR(200),
    description VARCHAR(500),
    keywords VARCHAR(200),
    canonical_url VARCHAR(255),
    og_title VARCHAR(200),
    og_description VARCHAR(500),
    og_image VARCHAR(255),
    robots VARCHAR(50),
    og_type VARCHAR(20),
    geo_summary TEXT,
    enabled INT DEFAULT 1,
    geo_optional INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 存量库补齐 geo_optional 列（幂等）
ALTER TABLE seo_configs ADD COLUMN IF NOT EXISTS geo_optional INT DEFAULT 0;

DROP TRIGGER IF EXISTS trg_seo_configs_updated_at ON seo_configs;
CREATE TRIGGER trg_seo_configs_updated_at BEFORE UPDATE ON seo_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE seo_configs IS 'SEO配置表';

-- 22.1 SEO关键词词库表
CREATE TABLE IF NOT EXISTS seo_keywords (
    id BIGSERIAL PRIMARY KEY,
    page_type VARCHAR(50),
    page_id BIGINT,
    keyword VARCHAR(200) NOT NULL,
    category VARCHAR(20),
    intent_note VARCHAR(255),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_seo_keywords_updated_at ON seo_keywords;
CREATE TRIGGER trg_seo_keywords_updated_at BEFORE UPDATE ON seo_keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE seo_keywords IS 'SEO关键词词库表';

CREATE INDEX IF NOT EXISTS idx_seo_keywords_page ON seo_keywords(page_type, page_id);

-- 22.2 SEO FAQ表
CREATE TABLE IF NOT EXISTS seo_faqs (
    id BIGSERIAL PRIMARY KEY,
    page_type VARCHAR(50),
    page_id BIGINT,
    question VARCHAR(500) NOT NULL,
    answer TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_seo_faqs_updated_at ON seo_faqs;
CREATE TRIGGER trg_seo_faqs_updated_at BEFORE UPDATE ON seo_faqs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE seo_faqs IS 'SEO FAQ表';

CREATE INDEX IF NOT EXISTS idx_seo_faqs_page ON seo_faqs(page_type, page_id);

-- 23. 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id BIGSERIAL PRIMARY KEY,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT,
    config_type VARCHAR(50),
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_system_configs_updated_at ON system_configs;
CREATE TRIGGER trg_system_configs_updated_at BEFORE UPDATE ON system_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE system_configs IS '系统配置表';

-- 24. 用户行为表
CREATE TABLE IF NOT EXISTS user_behaviors (
    id BIGSERIAL PRIMARY KEY,
    visitor_id VARCHAR(100),
    behavior_type VARCHAR(50),
    target_type VARCHAR(50),
    target_id BIGINT,
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE user_behaviors IS '用户行为表';

-- 25. 页面浏览表
CREATE TABLE IF NOT EXISTS page_views (
    id BIGSERIAL PRIMARY KEY,
    page_type VARCHAR(50),
    page_id BIGINT,
    user_id BIGINT,
    page_url VARCHAR(255),
    visitor_id VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    referer VARCHAR(255),
    visit_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE page_views IS '页面浏览表';

-- ----- 联系方式表 -----
CREATE TABLE IF NOT EXISTS contacts (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    value VARCHAR(500) NOT NULL,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 唯一约束，确保 ON CONFLICT DO NOTHING 生效，防止重复插入
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_contacts_type_value') THEN
    DELETE FROM contacts a USING contacts b
      WHERE a.id < b.id AND a.type = b.type AND a.value = b.value;
    ALTER TABLE contacts ADD CONSTRAINT uq_contacts_type_value UNIQUE (type, value);
  END IF;
END $$;

COMMENT ON TABLE contacts IS '联系方式表';
COMMENT ON COLUMN contacts.type IS '类型：手机/邮箱/座机/地址/微信/QQ/抖音';
COMMENT ON COLUMN contacts.value IS '联系方式值';
COMMENT ON COLUMN contacts.icon IS '预设 lucide 图标名，为空时前台按类型回退默认图标';
COMMENT ON COLUMN contacts.sort_order IS '排序';

-- ============================================================
-- 二、预置数据
-- ============================================================

-- ----- 权限数据 -----
INSERT INTO permissions (code, name, module, description) VALUES
('page:config:view',    '查看页面配置',   'page',       '查看首页、Banner、导航等配置'),
('page:config:edit',    '编辑页面配置',   'page',       '编辑首页、Banner、导航等配置'),
('product:view',        '查看产品',       'product',    '查看产品列表和详情'),
('product:create',      '创建产品',       'product',    '新增产品'),
('product:update',      '编辑产品',       'product',    '编辑产品信息'),
('product:delete',      '删除产品',       'product',    '删除产品'),
('product:publish',     '上下架产品',     'product',    '产品上下架操作'),
('solution:view',       '查看方案',       'solution',   '查看解决方案列表和详情'),
('solution:create',     '创建方案',       'solution',   '新增解决方案'),
('solution:update',     '编辑方案',       'solution',   '编辑解决方案'),
('solution:delete',     '删除方案',       'solution',   '删除解决方案'),
('case:view',           '查看案例',       'case',       '查看案例列表和详情'),
('case:create',         '创建案例',       'case',       '新增案例'),
('case:update',         '编辑案例',       'case',       '编辑案例'),
('case:delete',         '删除案例',       'case',       '删除案例'),
('article:view',        '查看文章',       'article',    '查看文章列表和详情'),
('article:create',      '创建文章',       'article',    '新增文章'),
('article:update',      '编辑文章',       'article',    '编辑文章'),
('article:delete',      '删除文章',       'article',    '删除文章'),
('whitepaper:view',     '查看白皮书',     'whitepaper', '查看白皮书列表'),
('whitepaper:create',   '创建白皮书',     'whitepaper', '新增白皮书'),
('whitepaper:update',   '编辑白皮书',     'whitepaper', '编辑白皮书'),
('whitepaper:delete',   '删除白皮书',     'whitepaper', '删除白皮书'),
('lead:view',           '查看线索',       'lead',       '查看线索列表和详情'),
('lead:update',         '编辑线索',       'lead',       '编辑线索信息'),
('lead:assign',         '分配线索',       'lead',       '分配线索给销售人员'),
('lead:export',         '导出线索',       'lead',       '导出线索数据'),
('ai:knowledge:view',   '查看AI知识库',   'ai',         '查看AI知识库内容'),
('ai:knowledge:edit',   '编辑AI知识库',   'ai',         '编辑AI知识库内容'),
('ai:chat:view',        '查看AI问答记录', 'ai',         '查看AI对话记录'),
('ai:config:edit',      '编辑AI配置',     'ai',         '编辑AI推荐话术、禁答词等'),
('seo:view',            '查看SEO配置',    'seo',        '查看SEO配置'),
('seo:edit',            '编辑SEO配置',    'seo',        '编辑SEO标题、描述、Sitemap等'),
('stats:view',          '查看数据统计',   'stats',      '查看PV/UV/线索等统计数据'),
('user:view',           '查看用户',       'user',       '查看用户列表'),
('user:create',         '创建用户',       'user',       '新增用户'),
('user:update',         '编辑用户',       'user',       '编辑用户信息和角色'),
('user:delete',         '删除用户',       'user',       '删除用户'),
('document:view',       '查看资料',       'document',   '查看资料列表'),
('document:create',     '上传资料',       'document',   '上传资料文件'),
('document:update',     '编辑资料',       'document',   '编辑资料信息'),
('document:delete',     '删除资料',       'document',   '删除资料'),
('home_section:view',   '查看首页区块',   'home',       '查看首页区块列表'),
('home_section:create', '创建首页区块',   'home',       '新增首页区块'),
('home_section:update', '编辑首页区块',   'home',       '编辑首页区块'),
('home_section:delete', '删除首页区块',   'home',       '删除首页区块'),
('about_section:view',  '查看关于区块',   'about',      '查看关于页面区块'),
('about_section:create','创建关于区块',   'about',      '新增关于页面区块'),
('about_section:update','编辑关于区块',   'about',      '编辑关于页面区块'),
('about_section:delete','删除关于区块',   'about',      '删除关于页面区块'),
('core_module:view',    '查看核心模块',   'core_module', '查看核心模块列表'),
('core_module:create',  '创建核心模块',   'core_module', '新增核心模块'),
('core_module:update',  '编辑核心模块',   'core_module', '编辑、排序、启停核心模块'),
('core_module:delete',  '删除核心模块',   'core_module', '删除核心模块'),
('system:api-docs:view', '查看接口文档',  'system',      '查看 Swagger 接口文档')
ON CONFLICT (code) DO NOTHING;

-- ----- 角色定义数据 -----
INSERT INTO roles (code, name, description, sort_order) VALUES
('SUPER_ADMIN', '超级管理员', '拥有系统全部权限', 1),
('NORMAL_USER', '普通用户', '拥有查看类权限', 2),
('TECH', '技术', '技术研发人员', 3),
('IMPLEMENT', '实施', '项目实施人员', 4),
('PRODUCT', '产品', '产品管理人员', 5),
('ADMIN', '行政', '行政管理人员', 6),
('SALES', '销售', '销售业务人员', 7),
('FINANCE', '财务', '财务管理人员', 8),
('OPS', '运维', '系统运维人员', 9)
ON CONFLICT (code) DO NOTHING;

-- ----- 角色权限映射 -----

-- 超级管理员（内部用户）: 全部权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'SUPER_ADMIN', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- 普通用户（外部用户）: 仅查看权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'NORMAL_USER', id FROM permissions WHERE code IN (
    'product:view', 'solution:view', 'case:view', 'article:view', 'whitepaper:view',
    'page:config:view', 'stats:view', 'home_section:view', 'about_section:view'
) ON CONFLICT (role, permission_id) DO NOTHING;

-- 游客: 无后台访问权限（无映射记录）

-- ----- 默认联系方式（占位，部署后可在后台修改）-----
INSERT INTO contacts (type, value, sort_order) VALUES
('座机', '010-00000000', 1)
ON CONFLICT DO NOTHING;

-- ----- 默认管理员账号（密码: admin123）-----
INSERT INTO users (username, password, email, real_name, role, user_type, status, deleted)
VALUES ('admin', '$2a$10$lmSNfJTvmFe0.t.5WBTUyuPmqwFWZ.7KzDfEvgBc3gyYj/qz5vJSy', 'admin@example.cn', '超级管理', 'SUPER_ADMIN', 'INTERNAL', 1, 0)
ON CONFLICT (username) DO NOTHING;

-- ----- 默认首页页脚配置（占位，部署后可在后台修改）-----
INSERT INTO system_configs (config_key, config_value, config_type, description) VALUES
('home_footer', '{"logo":"/logo.png","copyright":"示例科技有限公司 版权所有","icpNumber":"ICP备案号待配置","icpUrl":"https://beian.miit.gov.cn/#/Integrated/recordQuery","extra":[{"label":"公司名称","value":"示例科技有限公司"},{"label":"联系电话","value":"010-00000000"},{"label":"邮箱","value":"demo@example.com"}]}', 'json', '首页页脚内容配置'),
('site_brand', '{"siteName":"示例科技","siteFullName":"示例科技有限公司","copyright":"示例科技有限公司 版权所有","companyName":"示例科技有限公司","contactPhone":"010-00000000","contactEmail":"demo@example.com","icpNumber":"ICP备案号待配置","icpUrl":"https://beian.miit.gov.cn/#/Integrated/recordQuery","url":"https://demo.example.com","logo":"/logo.png"}', 'json', '站点/品牌配置')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- 知识库相关表
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  status INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE knowledge_bases IS '知识库';

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id BIGSERIAL PRIMARY KEY,
  knowledge_base_id BIGINT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  file_path VARCHAR(500) DEFAULT '',
  file_name VARCHAR(500) DEFAULT '',
  file_size BIGINT DEFAULT 0,
  content TEXT DEFAULT '',
  source_type VARCHAR(50) DEFAULT NULL,
  source_id BIGINT DEFAULT NULL,
  status INT DEFAULT 0,
  chunk_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE knowledge_documents IS '知识文档';

CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_source ON knowledge_documents(source_type, source_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  knowledge_base_id BIGINT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INT DEFAULT 0,
  tokens INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE knowledge_chunks IS '知识块';

CREATE INDEX IF NOT EXISTS idx_chunks_kb ON knowledge_chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON knowledge_chunks(document_id);

-- ============================================================
-- AI Consultant — 会话/消息/记忆/Token 统计表
-- AI 顾问后端专用，与 ai_conversations/ai_messages 独立
-- ============================================================

-- 1. AI 会话表
CREATE TABLE IF NOT EXISTS ai_session (
    session_id    VARCHAR(128) PRIMARY KEY,
    title         VARCHAR(256) NOT NULL DEFAULT '',
    system_prompt TEXT         NOT NULL DEFAULT '',
    model         VARCHAR(128) NOT NULL DEFAULT '',
	username      VARCHAR(128) NOT NULL DEFAULT '',
    created_at    DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
    updated_at    DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

COMMENT ON TABLE ai_session IS 'AI 顾问会话表，记录每次对话的元数据和模型配置';
COMMENT ON COLUMN ai_session.session_id IS '会话唯一标识';
COMMENT ON COLUMN ai_session.title IS '会话标题';
COMMENT ON COLUMN ai_session.system_prompt IS '系统提示词';
COMMENT ON COLUMN ai_session.model IS '使用的模型名称';
COMMENT ON COLUMN ai_session.created_at IS '创建时间（Unix 时间戳）';
COMMENT ON COLUMN ai_session.updated_at IS '最后更新时间（Unix 时间戳）';

-- 2. AI 消息表（多模态，content 为 JSONB）
CREATE TABLE IF NOT EXISTS ai_message (
    id           SERIAL PRIMARY KEY,
    session_id   VARCHAR(128) NOT NULL REFERENCES ai_session(session_id) ON DELETE CASCADE,
    role         VARCHAR(32) NOT NULL,
    content      JSONB NOT NULL,
    timestamp    DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_ai_message_session ON ai_message(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_ts      ON ai_message(timestamp);

COMMENT ON TABLE ai_message IS 'AI 顾问消息表，支持多模态（文本/图片）的会话消息';
COMMENT ON COLUMN ai_message.id IS '消息自增 ID';
COMMENT ON COLUMN ai_message.session_id IS '所属会话 ID';
COMMENT ON COLUMN ai_message.role IS '消息角色：user / assistant / system';
COMMENT ON COLUMN ai_message.content IS '消息内容 JSONB，可包含 text 和 image_url 等多模态字段';
COMMENT ON COLUMN ai_message.timestamp IS '消息时间戳（Unix 时间戳）';

-- 3. AI Token 消耗记录表
CREATE TABLE IF NOT EXISTS ai_token_usage (
    id                SERIAL PRIMARY KEY,
    session_id        VARCHAR(128) REFERENCES ai_session(session_id) ON DELETE SET NULL,
    model             VARCHAR(128) NOT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    cost_usd          DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    timestamp         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_session ON ai_token_usage(session_id);

COMMENT ON TABLE ai_token_usage IS 'AI Token 消耗统计表，记录每次 API 调用的 Token 用量和费用';
COMMENT ON COLUMN ai_token_usage.id IS '记录自增 ID';
COMMENT ON COLUMN ai_token_usage.session_id IS '关联的会话 ID';
COMMENT ON COLUMN ai_token_usage.model IS '模型名称';
COMMENT ON COLUMN ai_token_usage.prompt_tokens IS '输入 Token 数';
COMMENT ON COLUMN ai_token_usage.completion_tokens IS '输出 Token 数';
COMMENT ON COLUMN ai_token_usage.total_tokens IS '总 Token 数';
COMMENT ON COLUMN ai_token_usage.cost_usd IS '估算费用（美元）';
COMMENT ON COLUMN ai_token_usage.timestamp IS '记录时间';

-- 4. AI 长期记忆表
CREATE TABLE IF NOT EXISTS ai_long_term_memory (
    id           SERIAL PRIMARY KEY,
    session_id   VARCHAR(128),
    type         VARCHAR(32) NOT NULL DEFAULT 'summary',
    content      TEXT NOT NULL,
    timestamp    DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_ai_ltm_session ON ai_long_term_memory(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_ltm_ts      ON ai_long_term_memory(timestamp);

COMMENT ON TABLE ai_long_term_memory IS 'AI 顾问长期记忆表，存储从短期记忆中归纳的摘要信息';
COMMENT ON COLUMN ai_long_term_memory.id IS '记忆自增 ID';
COMMENT ON COLUMN ai_long_term_memory.session_id IS '关联的会话 ID（可为空）';
COMMENT ON COLUMN ai_long_term_memory.type IS '记忆类型，默认为 summary';
COMMENT ON COLUMN ai_long_term_memory.content IS '记忆内容文本';
COMMENT ON COLUMN ai_long_term_memory.timestamp IS '记忆时间戳（Unix 时间戳）';

-- 5. AI 提示词配置表
CREATE TABLE IF NOT EXISTS ai_prompt_config (
    id           SERIAL PRIMARY KEY,
    type         VARCHAR(32) NOT NULL,
    content      TEXT NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    updated_at   DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_config_type ON ai_prompt_config(type);

COMMENT ON TABLE ai_prompt_config IS 'AI 提示词配置表，存储系统提示词、推荐话术';
COMMENT ON COLUMN ai_prompt_config.id IS '自增 ID';
COMMENT ON COLUMN ai_prompt_config.type IS '类型: system_prompt / suggestion';
COMMENT ON COLUMN ai_prompt_config.content IS '配置内容';
COMMENT ON COLUMN ai_prompt_config.sort_order IS '排序顺序';
COMMENT ON COLUMN ai_prompt_config.updated_at IS '更新时间（Unix 时间戳）';

-- ============================================================
-- 6. 禁答主题表
-- ============================================================
CREATE TABLE IF NOT EXISTS forbidden_topics (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    threshold   REAL DEFAULT 0.85,
    enabled     BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forbidden_topics_enabled ON forbidden_topics(enabled);

COMMENT ON TABLE forbidden_topics IS 'AI 禁答主题表，按主题分组管理禁答话题';
COMMENT ON COLUMN forbidden_topics.id IS '自增 ID';
COMMENT ON COLUMN forbidden_topics.name IS '主题名称（如：模型信息、Prompt泄露）';
COMMENT ON COLUMN forbidden_topics.description IS '主题描述';
COMMENT ON COLUMN forbidden_topics.threshold IS '相似度阈值，默认 0.85';
COMMENT ON COLUMN forbidden_topics.enabled IS '是否启用';

-- 7. 禁答主题示例表
CREATE TABLE IF NOT EXISTS forbidden_topic_examples (
    id          BIGSERIAL PRIMARY KEY,
    topic_id    BIGINT NOT NULL REFERENCES forbidden_topics(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    embedding   VECTOR(1536),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_forbidden_examples_embedding ON forbidden_topic_examples
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

CREATE INDEX IF NOT EXISTS idx_forbidden_examples_topic ON forbidden_topic_examples(topic_id);

COMMENT ON TABLE forbidden_topic_examples IS '禁答主题示例表，每个主题下多条示例问法';
COMMENT ON COLUMN forbidden_topic_examples.id IS '自增 ID';
COMMENT ON COLUMN forbidden_topic_examples.topic_id IS '关联禁答主题 ID';
COMMENT ON COLUMN forbidden_topic_examples.content IS '示例文本';

-- ============================================================
-- 初始种子数据
-- ============================================================
INSERT INTO forbidden_topics (name, description, threshold, enabled) VALUES
('模型信息', '用户询问AI模型身份、名称、底层模型等问题', 0.85, TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO forbidden_topic_examples (topic_id, content)
SELECT t.id, v.content
FROM (VALUES
    ('模型信息', '你是什么模型')
) AS v(topic_name, content)
JOIN forbidden_topics t ON t.name = v.topic_name
WHERE NOT EXISTS (
    SELECT 1 FROM forbidden_topic_examples e
    WHERE e.topic_id = t.id AND e.content = v.content
);

-- ============================================================
-- 演示模块示例种子数据（依赖上述所有表已创建）
-- ============================================================

-- 首页区块内容
INSERT INTO home_sections (section_type, title, subtitle, description, image, url, extra_data, sort_order, status) VALUES
('hero', '演示横幅', '示例科技 数字化转型伙伴', '这是首页演示区块内容，展示企业数字化解决方案的能力与价值', '/images/demo-hero.jpg', '/demo-product', '{"badge":"DEMO","buttonText":"了解更多","buttonUrl":"/demo-product"}', 1, 1),
ON CONFLICT (title) DO NOTHING;

-- 关于页面区块
INSERT INTO about_sections (section_type, title, subtitle, description, image, extra_data, sort_order, status) VALUES
('description', '公司简介', '关于我们', '示例科技有限公司是一家专注于企业数字化转型的服务商，致力于为客户提供端到端的数字化解决方案。', '/images/demo-about.jpg', NULL, 1, 1),
ON CONFLICT (title) DO NOTHING;

-- 演示产品 · 内容分类（双层嵌套模块）
INSERT INTO content_categories (module_key, name, slug, description, cover_image, sort_order, status) VALUES
('demo-product', '演示产品A', 'demo-product-a', '演示产品A的示例分类', NULL, 1, 1),
ON CONFLICT (module_key, slug) DO NOTHING;

-- 演示产品 · 内容管理（关联上面的分类）
INSERT INTO content_items (module_key, title, slug, category_id, summary, content, cover_image, sort_order, status, is_top, published_at, author, source, view_count, seo_title, seo_description)
SELECT v.module_key, v.title, v.slug, c.id, v.summary, v.content, NULL, v.sort_order, v.status, v.is_top, NOW(), v.author, v.source, v.view_count, v.seo_title, v.seo_description
FROM (VALUES
    ('demo-product', '演示产品一', 'demo-product-1', 'demo-product-a', '这是演示产品一的示例摘要', '<h2>产品概述</h2><p>演示产品一，帮助企业构建数字化核心能力。</p>', 1, 1, 1, '示例管理员', '示例来源', 128, '演示产品一 - 示例科技', '演示产品一的SEO描述'),
) AS v(module_key, title, slug, category_slug, summary, content, sort_order, status, is_top, author, source, view_count, seo_title, seo_description)
JOIN content_categories c ON c.module_key = v.module_key AND c.slug = v.category_slug
WHERE NOT EXISTS (
    SELECT 1 FROM content_items ci WHERE ci.module_key = v.module_key AND ci.slug = v.slug
);

-- 演示方案 · 内容管理（单层模块，使用分组）
INSERT INTO content_items (module_key, title, slug, group_name, summary, content, cover_image, sort_order, status, is_top, published_at, author, source, view_count, seo_title, seo_description) VALUES
('demo-solution', '演示方案一', 'demo-solution-1', '行业解决方案', '这是演示方案一的示例摘要', '<h2>方案概述</h2><p>演示方案一，覆盖制造业数字化全场景。</p>', NULL, 1, 1, 1, NOW(), '示例管理员', '示例来源', 168, '演示方案一 - 示例科技', '演示方案一的SEO描述'),
ON CONFLICT (module_key, slug) DO NOTHING;

-- FAQ管理
INSERT INTO faqs (question, answer, category, product_id, sort_order, status, view_count) VALUES
('演示产品一支持哪些部署方式？', '支持私有化部署与云上部署两种方式，可根据企业实际情况灵活选择。', '演示产品', NULL, 1, 1, 52),
ON CONFLICT DO NOTHING;

