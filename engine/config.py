import os
import json
import logging
import sys

def get_config():
    return {
        'STORAGE_TYPE': os.environ.get('STORAGE_TYPE', 'local'),
        'STORAGE_PATH': os.environ.get('STORAGE_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')),
        'MODEL_PATH': os.environ.get('MODEL_PATH', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')),
        'DATABASE_URL': os.environ.get('DATABASE_URL', ''),
        'LOG_LEVEL': os.environ.get('LOG_LEVEL', 'INFO'),
        'MAX_ROWS_PREVIEW': int(os.environ.get('MAX_ROWS_PREVIEW', '1000')),
        'MAX_EXECUTION_TIME': int(os.environ.get('MAX_EXECUTION_TIME', '3600')),
    }

def setup_logging(level=None):
    cfg = get_config()
    log_level = level or cfg['LOG_LEVEL']
    
    class JsonFormatter(logging.Formatter):
        def format(self, record):
            log_entry = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'message': record.getMessage(),
                'module': record.module,
            }
            if record.exc_info:
                log_entry['exception'] = self.formatException(record.exc_info)
            return json.dumps(log_entry)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    
    logger = logging.getLogger('engine')
    logger.setLevel(getattr(logging, log_level.upper()))
    logger.addHandler(handler)
    logger.propagate = False
    return logger
