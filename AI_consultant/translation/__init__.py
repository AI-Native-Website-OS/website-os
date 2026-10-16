"""运行时自动翻译子模块。

- config:    读取 translation_* 系统配置
- engine:    翻译引擎抽象（LlmEngine 一期实现；NmtEngine 预留）
- pipeline:  翻译入口
- worker:    后台预翻译 worker
- router:    内部健康检查接口

为避免包导入副作用，这里不预先导入子模块；请按需 ``from translation.xxx import ...``。
"""
