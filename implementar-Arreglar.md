Cosas a arreglar:

Ver Stock:
- Poner las cabeceras acordes a las palabras que yo quiero, quitar sku por ejemplo y cambiarlo por referencia, poner ancho, largo, espesor...
- Poner en las familias todos los materiales que tenemos, GOMA, FIELTRO, VERDE, CARAMELO, PVC
- Terminar de arreglar el formulario de pedidos
- En los detalles poner tambien el resto de datos, es importante tener tanto el ancho como el largo, espesor de la bobina

Ver Pedidos:
-Poner todos los datos de las bobinas, ancho, largo, espesor, asi como todos los datos de la bobina, y poner todos los gastos tambien detallados dentro del perfil del detalle del pedido, asi como sus datos corresopndientes

Ver Tarifa Venta:
Node.js: GET /api/tarifa-venta para MATERIALES EN STOCK, tipo: final
Error en /api/tarifa-venta (materiales): consultarStockMateriasPrimas is not defined

Nuevo Pedido Nacional/Importacion
-Eliminar la fecha de llegada del pedido, tambien podemos borrarla del database
-Lo de seleccionar de un desplegable el artidulo(materia prima), eso no me funciona, salvo que, hagamos una tabla nueva con dichas referencias previas, por ejemplo, podemos ponder de primeras un desplegable para seleccionar el tipo de contenedor(GOMA, PVC, CARAMELO, VERDE, FIELTROM, NEGRA(teniendo en cuenta que a veces segun nos cuadren los numeros para rellenar el contenedor, entonces tenedremos que poder seleccionar o un tipo de contenedor, o poder hacer como contenedores mixtos, y segun el tipo de familia de materiales que seleccionemos, pues nos dejen elegir esas referencias))
FAMILIAS(GOMA, PVC, CARAMELO, VERDE, FIELTRO, NEGRA), ten en cuenta que quizá en un futuro debemos de añadir nuevas familias
GOMA(6mm, 8mm, 10mm, 12mm, 15mm) 
PVC(Blanco2mm, Blanco3mm, Verde2mm, Verde3mm, Azul2mm, Azul3mm)
FIELTRO(Fieltro10, Fieltro15)
CARAMELO(6mm, 8mm, 10mm, 12mm)
VERDE(6mm, 8mm, 10mm, 12mm)
NEGRA(6mm, 8mm, 10mm, 12mm)


y dentro de esta linea, nos deje añadirle a cada bobina los siguientes detalles
Su identificador autoincrementable que no toca el usuario, pero lo realiza el programa automaticamente como clave primaria,
Referencia, Ancho, Largo, Rollos, Peso por metro, 
y bueno claro, tambien  el USD/m en case de pedidos de importacion, y en EUR/m en caso de los pedidos nacionales
no olvidar de la ubicacion 




-No se calcula el coste estandar de los productos, probablemente porque no encuentra el material buscado en la tarifa


-Eliminar el coste de adquisición de la maquinaria

-EN los procesos, vamos a calcular lo que se tarda en segundos o quizá en minutos, por ejemplo, yo tardo 30 segundos en realizar una faldeta de goma de 6mm de aldama en la prensa hidraulica, y luego tardo unos 20 segundos en grabarlo en laser, entonces tambien debe de dejarme ponerle en el proceso varias maquinas, ya que pueden intervenir varias, y poder poner sus tiempos correspondientes

-Cuando creo una orden de produccion no pone el apartado de coste real, probablemente porque no encuentra los materiales en el almacen, ya que lo que tenemos en seed_database no son datos reales, te voy a poner datos de ejemplo para que te inventes datos reales a continucacion.

-Stock productos finales no es necesario, no vamos a manejar stock de esa forma

-Poner bonito Ver Stock