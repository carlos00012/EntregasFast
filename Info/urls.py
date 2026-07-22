#Archivo para gestionar las rutas internas dela aplicacion nomina
from django.urls import path
#Importamos la lógica de negocio de la aplicación
from . import views
#Listadp de rutas de la Aplicación
urlpatterns = [
    path('inicio/', views.inicio),
]