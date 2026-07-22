from django.urls import path
from . import views

urlpatterns = [
    path('', views.inicio, name='inicio'),
    path('login-admin/', views.login_admin, name='login_admin'),
    path('logout-admin/', views.logout_admin, name='logout_admin'),
    path('admin-panel/', views.admin_panel, name='admin_panel'),
    path('guardar-conductor/', views.guardar_conductor, name='guardar_conductor'),
    path('actualizar-estado/<int:paquete_id>/', views.actualizar_estado_paquete, name='actualizar_estado_paquete'),
    path('dashboard/', views.dashboard_cliente, name='dashboard_cliente'),
    path('rastreo/', views.rastreo_envio, name='rastreo_envio'),
]