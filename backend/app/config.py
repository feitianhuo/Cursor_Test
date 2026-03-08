import os
from pathlib import Path

import yaml
from dotenv import load_dotenv

load_dotenv()

CONFIG_PATH = Path(__file__).parent.parent / "config.yaml"


def load_config() -> dict:
    """从 config.yaml 加载配置，环境变量可覆盖。"""
    config = {}
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f) or {}

    db = config.get("database", {})
    qwen = config.get("llm", {}).get("qwen", {})
    openai_cfg = config.get("llm", {}).get("openai", {})

    return {
        "db_host": os.getenv("DB_HOST", db.get("host", "172.16.100.15")),
        "db_port": int(os.getenv("DB_PORT", db.get("port", 13306))),
        "db_user": os.getenv("DB_USER", db.get("user", "root")),
        "db_password": os.getenv("DB_PASSWORD", db.get("password", "232323")),
        "db_name": os.getenv("DB_NAME", db.get("database", "vibecoding")),
        "qwen_api_key": os.getenv("DASHSCOPE_API_KEY", qwen.get("api_key", "")),
        "qwen_base_url": qwen.get("base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "qwen_model": qwen.get("model", "qwen-plus"),
        "openai_api_key": os.getenv("OPENAI_API_KEY", openai_cfg.get("api_key", "")),
        "openai_base_url": openai_cfg.get("base_url", "https://api.openai.com/v1"),
        "openai_model": openai_cfg.get("model", "gpt-4o-mini"),
    }


def get_database_url() -> str:
    # 默认使用 SQLite，方便本地运行。如果需要 MySQL，请修改此处或使用环境变量。
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url
    
    # 也可以根据环境变量决定是否使用 MySQL
    if os.getenv("USE_MYSQL") == "true":
        config = load_config()
        return (
            f"mysql+pymysql://{config['db_user']}:{config['db_password']}"
            f"@{config['db_host']}:{config['db_port']}/{config['db_name']}"
        )
    
    # 默认使用本地 SQLite
    return "sqlite:///./chat.db"
