from sqlalchemy import Column, Integer, String
from database import Base
from uuid import uuid1

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    email = Column(String(120),unique=True)
    fullname = Column(String(50))
    data = Column(String(1000000))
    filters = Column(String(1000000))

    def __init__(self, fullname=None, email=None, data=None, filters=''):
        self.fullname = fullname
        self.email = email
        self.data = data
        self.filters = filters

    def __repr__(self):
        return '<User %r>' % (self.fullname)