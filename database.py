#http://flask.pocoo.org/docs/0.10/patterns/sqlalchemy/

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.ext.declarative import declarative_base

#database_url = os.environ['DATABASE_URL']
#check if on local or in heroku
try:
	os.environ['HEROKU_ON']
	database_url = os.environ['DATABASE_URL']
except:
	database_url = 'sqlite:///'

engine = create_engine(database_url, convert_unicode=True)
db_session = scoped_session(sessionmaker(autocommit=False,
                                         autoflush=False,
                                         bind=engine))
Base = declarative_base()
Base.query = db_session.query_property()

def init_db():
    # import all modules here that might define models so that
    # they will be registered properly on the metadata.  Otherwise
    # you will have to import them first before calling init_db()
    import models
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

