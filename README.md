# MarkItDone

This is an example django project using some of my django/js libraries:

*  [django-todo-lists](https://github.com/pawartur/django-todo-lists)
*  [django-rest-views](https://github.com/pawartur/django-rest-views)
*  [backbone-extensions](https://github.com/pawartur/backbone-extensions)

This is also the code behind the [markitdone.com](http://www.markitdone.com)

## How to set it up and running

* clone this repository
* install the requirements from requirements.txt
* create your localsettings.py (you can use localsettings.example.py as a template)
* run python manage.py syncdb from the project root
* get your celery up and running (this it's set to use mongodb as a broker in settings.py)
* get the django server up and running
