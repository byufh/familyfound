
from .fsapi import user_info, FS
from .fsapi import FSSqlite, FSMongo

backends = {'sqlite': FSSqlite, 'mongo': FSMongo}

