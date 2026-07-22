#Archivo para gestionar las rutas internas dela aplicacion Info
from django.urls import path
#Importamos la lógica de negocio de la aplicación
from . import views
#Listadp de rutas de la Aplicación
urlpatterns = [
    # INICIO PRINCIPAL
    path('', views.inicio),
    
    # PANEL ADMINISTRADOR
    path('admin-panel/', views.admin_panel),
    path('conductor/guardar/', views.guardar_conductor),
    path('paquete/<int:paquete_id>/actualizar-estado/', views.actualizar_estado_paquete),
    
    # PANEL CLIENTE / DASHBOARD
    path('dashboard/', views.dashboard_cliente),
    
    # RASTREO DE ENVÍOS
    path('rastreo/', views.rastreo_envio),
]