import os
import requests
import glob

#import flask modules
from flask import Flask, request, session, g, redirect, url_for, \
	 abort, render_template, flash

#import database things
from database import db_session
from models import User

#start app
app = Flask(__name__)
app.config.from_object(__name__)

#database handling
@app.teardown_appcontext
def shutdown_session(exception=None):
    db_session.remove()

#index
@app.route('/')
def hello():
	return render_template('index.html')

#index
@app.route('/index')
def index():
	return render_template('index.html')

#index
@app.route('/in')
def render_charts():
	return render_template('charts.html')


#view database
@app.route('/userlist')
def userlist():
	return "<br/>".join([i.fullname+": "+i.email for i in User.query.all()])

#record in database
@app.route('/database', methods=['POST'])
def database():

	#check if user is in database
	if ( User.query.filter(User.email == request.form['email']).count() > 0):
		return "already recorded"

	#else, new user
	us = User(request.form['fullname'], request.form['email'])
	db_session.add(us)
	db_session.commit()

	#Get Message
	subject = 'Welcome to Papaya'
	message = "Hello "+ request.form['givenname'] + "!\n\n We're so glad you signed up for our alpha service. This is the humble start of an incredibly simple way to make your calendar data useful, so you can learn about and adapt to how you spend time. Over the course of the coming year, we will be rolling out a series of amazing features and will periodically keep you updated. \n\n Carpe Diem!\n- Papaya Team \n\n"
	name = request.form['fullname']
	address = request.form['email']

	#sent email
	requests.post(
		"https://api.mailgun.net/v2/sandbox371c5172c8984738b35884a88e2fc92b.mailgun.org/messages",
		auth=("api", "key-b90954e35d130bce6ed45af6fe5b795a"),
		data={"from": "Papaya App <postmaster@sandbox371c5172c8984738b35884a88e2fc92b.mailgun.org>",
					"to": name+" <"+address+">",
					"subject": subject,
					"text": message})

	return 'Welcome Email Sent'


#record data in database
@app.route('/datalog', methods=['POST'])
def datalog():
	
	db_session.query(User).filter(User.email == request.form['email']).update({User.data: request.form['data']})
	db_session.commit()
	return 'data logged'

#log filters in database
@app.route('/savefilters', methods=['POST', 'GET'])
def savefilters():
	if request.method == 'POST':
		db_session.query(User).filter(User.email == request.form['email']).update({User.filters: request.form['filters']})
		db_session.commit()
		return 'filters saved'
	else:
		return db_session.query(User).filter(User.email == request.args.get('email')  )[0].filters



#testing features

@app.route('/admin', methods=['POST', 'GET'])
def admin():
	error = None
	if request.method == 'POST':
		if (request.form['username'] == "vinhiry" and request.form['password'] == "ES95rfinalproject"):
			data_list = glob.glob("data/*.json")
			return render_template('admin.html', data_list = data_list)
		else:
			error = 'Invalid username/password'
	return render_template('login.html', error=error )


#@app.route('/email', methods=['POST'])
def email():

	#Get Message
	subject = request.form['subject']
	message = request.form['message']
	name = request.form['fullname']
	address = request.form['email']

	#sent email
	requests.post(
		"https://api.mailgun.net/v2/sandbox371c5172c8984738b35884a88e2fc92b.mailgun.org/messages",
		auth=("api", "key-b90954e35d130bce6ed45af6fe5b795a"),
		data={"from": "Papaya App <postmaster@sandbox371c5172c8984738b35884a88e2fc92b.mailgun.org>",
					"to": name+" <"+address+">",
					"subject": subject,
					"text": message})

	return 'OK'


if __name__ == '__main__':
	app.run(debug=True)

