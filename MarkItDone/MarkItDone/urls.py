from django.conf.urls import patterns, include, url
from django.http import HttpResponse
from django.views.generic import TemplateView
from django.contrib.auth.views import login, logout
from django.contrib.auth.decorators import login_required
from commons.views import set_timezone

from rest_views.decorators import login_required_ajax

# Uncomment the next two lines to enable the admin:
from django.contrib import admin
admin.autodiscover()

@login_required_ajax
def authenticate(request):
    response = HttpResponse()
    response.status_code = 204
    return response

urlpatterns = patterns('',
    url(r'^$', login_required(login_url="/accounts/login/")(TemplateView.as_view(template_name="main.html")), name="main"),
    url(r'^todos/', include('todo_lists.urls')),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^accounts/set_timezone/', set_timezone, name="set_timezone"),
    url(r'^accounts/authenticate/', authenticate, name="authenticate"),
    (r'^accounts/', include('registration.backends.default.urls'))
)

from django.contrib.staticfiles.urls import staticfiles_urlpatterns
urlpatterns += staticfiles_urlpatterns()
