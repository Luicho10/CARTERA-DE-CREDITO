# CARTERA-DE-CREDITO

Sistema web para controlar las 6 carteras de crédito a partir de extractos PDF de Datapar.

## Funciones iniciales
- Importación de PDF Datapar.
- Extracción de vendedor de origen, entidad/cliente, factura, vencimiento y saldo.
- Exclusión de recibimientos, cobros y devoluciones como documentos de cartera.
- Conservación de registros marcados como `ANULADO`.
- Asignación manual del vendedor actual/captador sin perder el vendedor de origen.
- Directorio de clientes.
- Seis carteras: Normal USD, Normal Gs., Gestión de Cobro USD, Gestión de Cobro Gs., Judicial USD y Judicial Gs.
- Resumen consolidado por cartera y moneda.
- Resumen por vendedor actual.

## Fuente de datos de prueba
El formato objetivo es el extracto `Cuentas a Cobrar y Pagar` de Datapar, con agrupación por vendedor y orden por vencimiento.

## Publicación
El repositorio incluye GitHub Actions para publicar la aplicación estática mediante GitHub Pages.
