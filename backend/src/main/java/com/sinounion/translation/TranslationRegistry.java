package com.sinounion.translation;

import com.sinounion.entity.AboutSection;
import com.sinounion.entity.Banner;
import com.sinounion.entity.ContactInfo;
import com.sinounion.entity.ContentCategory;
import com.sinounion.entity.ContentItem;
import com.sinounion.entity.CoreModule;
import com.sinounion.entity.Faq;
import com.sinounion.entity.HomeSection;
import com.sinounion.entity.IndustryChain;
import com.sinounion.entity.Partner;
import com.sinounion.entity.Permission;
import com.sinounion.entity.Role;
import com.sinounion.entity.SeoConfig;
import com.sinounion.entity.SeoFaq;
import com.sinounion.vo.RoleVO;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 可翻译资源注册表：声明哪些实体的哪些字段需要翻译。
 * 未登记的字段/实体一律不翻译，保证范围可控。
 */
@Component
public class TranslationRegistry {

    private final Map<String, TranslatableResource> byType = new LinkedHashMap<>();
    private final Map<Class<?>, TranslatableResource> byClass = new HashMap<>();

    /** 配置类资源（system_configs 中的 JSON）的可译字段。 */
    private final Map<String, List<String>> configFields = new HashMap<>();

    /** 递归翻译全部含中文叶子节点的配置类资源（如 footer / 通知 / 版本页）。 */
    private final Set<String> recursiveConfigTypes = new LinkedHashSet<>();

    /** 实体的 JSON 字符串字段（如 extraData），按 JSON 路径逐叶子翻译。 */
    private final Map<Class<?>, Set<String>> jsonEntityFields = new HashMap<>();

    public TranslationRegistry() {
        register("content_item", ContentItem.class, ContentItem::getId,
                Arrays.asList("title", "summary", "content", "seoTitle", "seoDescription"));
        register("core_module", CoreModule.class, CoreModule::getId,
                Arrays.asList("moduleName", "moduleTitle", "moduleDescription"));
        register("home_section", HomeSection.class, HomeSection::getId,
                Arrays.asList("title", "subtitle", "description"));
        register("about_section", AboutSection.class, AboutSection::getId,
                Arrays.asList("title", "subtitle", "description"));
        register("faq", Faq.class, Faq::getId, Arrays.asList("question", "answer"));
        register("seo_faq", SeoFaq.class, SeoFaq::getId, Arrays.asList("question", "answer"));
        register("banner", Banner.class, Banner::getId, Arrays.asList("title", "subtitle"));
        register("partner", Partner.class, Partner::getId, Collections.singletonList("name"));
        register("industry_chain", IndustryChain.class, IndustryChain::getId,
                Arrays.asList("name", "description"));
        register("content_category", ContentCategory.class, ContentCategory::getId,
                Arrays.asList("name", "description"));
        register("seo_config", SeoConfig.class, SeoConfig::getId,
                Arrays.asList("title", "description", "keywords", "ogTitle", "ogDescription", "geoSummary"));
        register("contact_info", ContactInfo.class, ContactInfo::getId, Collections.singletonList("type"));
        register("permission", Permission.class, Permission::getId,
                Arrays.asList("name", "description"));
        register("role", RoleVO.class, vo -> roleId(vo == null ? null : vo.getCode()),
                Arrays.asList("name", "description"));
        register("role", Role.class, role -> roleId(role == null ? null : role.getCode()),
                Arrays.asList("name", "description"));

        // 配置类资源：字段取自 system_configs 的 JSON 值
        configFields.put("site_brand",
                Arrays.asList("siteName", "siteDescription", "companyName", "copyright"));
        configFields.put("site_notice", Collections.singletonList("content"));

        // 递归翻译全部含中文叶子节点的配置类资源
        recursiveConfigTypes.addAll(Arrays.asList(
                "home_footer", "site_notices", "ai_website_config"));

        // 实体的 JSON 字符串字段：按 JSON 路径逐叶子翻译（含前台展示组数据）
        jsonEntityFields.put(HomeSection.class, new HashSet<>(Collections.singletonList("extraData")));
        jsonEntityFields.put(AboutSection.class, new HashSet<>(Collections.singletonList("extraData")));
        jsonEntityFields.put(ContentItem.class, new HashSet<>(Collections.singletonList("extraData")));
    }

    /** 角色主键为字符串 code，映射为稳定 long 用于翻译条目。 */
    private static Long roleId(String code) {
        return code == null ? null : (long) code.hashCode();
    }

    private <T> void register(String type, Class<T> entityClass,
                              java.util.function.Function<T, Long> idResolver, List<String> fields) {
        TranslatableResource resource = new TranslatableResource(
                type, entityClass, entity -> idResolver.apply(entityClass.cast(entity)), fields);
        byType.put(type, resource);
        byClass.put(entityClass, resource);
    }

    public TranslatableResource byType(String type) {
        return byType.get(type);
    }

    public TranslatableResource byClass(Class<?> cls) {
        return byClass.get(cls);
    }

    public List<String> configFields(String type) {
        return configFields.getOrDefault(type, Collections.emptyList());
    }

    /** 该配置资源是否按递归方式翻译全部含中文叶子节点。 */
    public boolean isRecursiveConfig(String type) {
        return recursiveConfigTypes.contains(type);
    }

    /** 该实体类的 JSON 字段集合。 */
    public Set<String> jsonFields(Class<?> cls) {
        return jsonEntityFields.getOrDefault(cls, Collections.emptySet());
    }
}
