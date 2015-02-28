import database
database.init_db()


from models import User
u = User('adminuni','moouni@moo.com')
database.db_session.add(u)
database.db_session.commit()