var promo = 'q';
document.getElementById("prom").innerHTML = 'Queen';

function promoQ(){
  promo = 'q';
  document.getElementById("prom").innerHTML = 'Queen';
}

function promoR(){
  promo = 'r';
  document.getElementById("prom").innerHTML = 'Rook';
}

function promoB(){
  promo = 'b';
  document.getElementById("prom").innerHTML = 'Bishop';
}

function promoN(){
  promo = 'n';
  document.getElementById("prom").innerHTML = 'Knight';
}

var board = null
var game = new Chess()
var $status = $('#status')
var $fen = $('#fen')
var $pgn = $('#pgn')
var whiteSquareGrey = '#a9a9a9'
var blackSquareGrey = '#696969'

function resetState() {
  game.reset()
  board.position(game.fen())
  updateStatus();
}

var alphabet = { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f', 6: 'g', 7: 'h'}
var alphabetreverse = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7}
var piecesDict = { 'P': 0x1, 'N': 0x2, 'B': 0x3, 'R': 0x4, 'Q': 0x5, 'K': 0x6, 'p': 0x7, 'n': 0x8, 'b': 0x9, 'r': 0xA, 'q': 0xB, 'k': 0xC}

function makeHex(fenToChange) {
  var pos = fenToChange.split(" ")[0];
  var hexPos = [];
  var simplifiedFEN = "";

  for (var i = 0; i < pos.length; i++) {
    if (isNaN(pos[i])) {
      if (pos[i] === "/") {
        continue;
      } else {
        simplifiedFEN += pos[i];
      }
    } else {
      for (var j = 0; j < parseInt(pos[i], 10); j++) {
        simplifiedFEN += "0";
      }
    }
  }

  for (var k = 0; k < simplifiedFEN.length; k++){
    if (isNaN(simplifiedFEN[k])) {
      hexPos.push(piecesDict[simplifiedFEN[k]]);
    } else {
      hexPos.push(0);
    }
  }

  return hexPos;
}

var model = null;

function buildModel() {
  model = tf.sequential({
    layers: [
      tf.layers.inputLayer({inputShape: [64]}),
      tf.layers.reLU({inputShape: [64]}),
      tf.layers.activation({activation: 'relu6'}),
      tf.layers.dense({units: 64, activation: 'relu'}),
      tf.layers.dense({units: 1, activation: 'sigmoid'})
    ]
  });
  const adam1 = tf.train.adam(0.15);

  model.compile({
    optimizer: adam1,
    loss: 'meanSquaredError'
  });

  model.fit(
    fens,
    fensEval,
    {
      epochs: 100,
      batchSize: 10,
      callbacks: tf.callbacks.earlyStopping({monitor: 'loss'})
  });

  document.getElementById("model-p").innerHTML = "Model has been trained";
}

function evalBoard() {
  return model.predict(tf.tensor(makeHex(game.fen())).reshape([1, 64])).dataSync[0];
}

function findMove(depth, alpha, beta, isMaxing) {
  var nodes = game.moves()
  var maxVal = -9007199254740990
  var minVal = 9007199254740990
  var bestMove;
  var tryMove;

  nodes.sort(function(a, b){return 0.5 - Math.random()});

  if (depth === 0 || nodes.length === 0) {
    return [null, evalBoard()];
  }

  for (var i = 0; i < nodes.length; i++) {
    tryMove = nodes[i];
    game.move(tryMove);
    var [nodeBestMove, nodeValue] = findMove(depth - 1, alpha, beta, !isMaxing);
    game.undo();

    if ( isMaxing ) {
      if ( nodeValue > maxVal) {
        maxVal = nodeValue;
        bestMove = tryMove;
      }
      if ( nodeValue > alpha ) {
        alpha = nodeValue;
      }
    } else {
      if ( nodeValue < minVal) {
        minVal = nodeValue;
        bestMove = tryMove;
      }
      if ( nodeValue < beta ) {
        beta = nodeValue;
      }
    }

    if (alpha >= beta) {
      break;
    }
  }

  if ( isMaxing ) {
    return [bestMove, maxVal];
  } else {
    return [bestMove, minVal];
  }
}

var best = null

function playBestMove() {
  board.position(game.fen())
  if ( game.turn() === 'w'){
    best = findMove(4, -9007199254740990, 9007199254740990, true)
  } else {
    best = findMove(4, -9007199254740990, 9007199254740990, false)
  }
  game.move(best[0])
  board.position(game.fen())
  updateStatus()
}

function removeGreySquares () {
    $('#board .square-55d63').css('background', '')
}

function greySquare (square) {
    var $square = $('#board .square-' + square)
  
    var background = whiteSquareGrey
    if ($square.hasClass('black-3c85d')) {
      background = blackSquareGrey
    }
  
    $square.css('background', background)
}

function onDragStart (source, piece, position, orientation) {
  // do not pick up pieces if the game is over
  if (game.game_over()) return false

  // only pick up pieces for the side to move
  if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }

}

function onDrop (source, target) {
    removeGreySquares()

  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: promo 
  })

  // illegal move
  if (move === null) return 'snapback'

  window.setTimeout(playBestMove(), 250);

  updateStatus()
}

function onMouseoverSquare (square, piece) {
    // get list of possible moves for this square
    var moves = game.moves({
      square: square,
      verbose: true
    })
  
    // exit if there are no moves available for this square
    if (moves.length === 0) return
  
    // highlight the square they moused over
    greySquare(square)
  
    // highlight the possible squares for this piece
    for (var i = 0; i < moves.length; i++) {
      greySquare(moves[i].to)
    }
}

function onMouseoutSquare (square, piece) {
    removeGreySquares()
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd () {
  board.position(game.fen())
}

function updateStatus () {
  var status = ''

  var moveColor = 'White'
  if (game.turn() === 'b') {
    moveColor = 'Black'
  }

  // checkmate?
  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
  }

  // draw?
  else if (game.in_draw()) {
    status = 'Game over, drawn position'
  }

  // game still on
  else {
    status = moveColor + ' to move'

    // check?
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check'
    }
  }

  $status.html(status)
  $fen.html(game.fen())
  $pgn.html(game.pgn())
}

var config = {
  draggable: true,
  position: 'start',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onMouseoutSquare: onMouseoutSquare,
  onMouseoverSquare: onMouseoverSquare,
  onSnapEnd: onSnapEnd
}
board = Chessboard('board', config)

updateStatus()

function compVsComp(){
  resetState();
  window.setInterval(playBestMove, 100);
}

function asWhite(){
  resetState();
  board.orientation('white');
}

function asBlack(){
  resetState();
  board.orientation('black');
  window.setTimeout(playBestMove(), 250);
}