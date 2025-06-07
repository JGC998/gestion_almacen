Cosas a arreglar:

3.No se calcula el coste estandar de los productos, probablemente porque no encuentra el material buscado en la tarifa
4.Eliminar el coste de adquisición de la maquinaria
5.EN los procesos, vamos a calcular lo que se tarda en segundos o quizá en minutos, por ejemplo, yo tardo 30 segundos en realizar una faldeta de goma de 6mm de aldama en la prensa hidraulica, y luego tardo unos 20 segundos en grabarlo en laser, entonces tambien debe de dejarme ponerle en el proceso varias maquinas, ya que pueden intervenir varias, y poder poner sus tiempos correspondientes
6.Cuando creo una orden de produccion no pone el apartado de coste real, probablemente porque no encuentra los materiales en el almacen, ya que lo que tenemos en seed_database no son datos reales, te voy a poner datos de ejemplo para que te inventes datos reales a continucacion.
7.Stock productos finales no es necesario, no vamos a manejar stock de esa forma

Creacion de pedidos para tener una tarifa mas realista:

En mi almacen debo de tener los siguientes productos:
    Goma, normlamente entre 100 y 200 metros:
        6mm varios anchos
        8mm
        10mm
        12mm
        15mm

    Fieltro, 3 anchos, 600, 1200, 1800:
        F15
        F10

Vamos a empezar con eso, y ya despues meteré datos reales.