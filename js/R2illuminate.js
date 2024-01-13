function r2NamesDone() {
    var i = 0;
    numrounds = $("#R2-hands").val();

    if(numrounds == 12) {
        dealcards = 1;
        maxdeal = 12;
        dealincrement = 1;
    }
    if(numrounds == 6) {
        dealcards = 2;
        maxdeal = 12;
        dealincrement = 2;
    }
    if(numrounds == 23) {
        dealcards = 1;
        maxdeal = 12;
        dealincrement = 1;
    }

    $("#selectedGame").text("Illuminate");
    $("#select-game").hide();
    $("#selectedGame").show();

    $("#R2scorepad").show();
    $("#R1scorepad").hide();
    $("#gracescorepad").hide();
    $("#mercyscorepad").hide();

    $("#R2col1name").text(player1name);
    $("#R2col2name").text(player2name);
    $("#R2col3name").text(player3name);
    $("#R2col4name").text(player4name);

    newrow = "<th>Players:</th><th>"+player1name+"</th>";

    if(numplayers == 2) {
        $(".col2").hide();
        $(".col3").show();
        $(".col4").hide();
        newrow = newrow+"<th>"+player3name+"</th>";
    }

    if(numplayers == 3) {
        $(".col2").show();
        $(".col3").hide();
        $(".col4").show();
        newrow = newrow+"<th>"+player2name+"</th><th>"+player4name+"</th>";
    }

    if(numplayers == 4) {
        $(".col2").show();
        $(".col3").show();
        $(".col4").show();
        newrow = newrow+"<th>"+player2name+"</th><th>"+player3name+"</th><th>"+player4name+"</th>";
    }

    $("#dealer").text(player1name);
    startplayer = R2nextplayer(1,numplayers);

    $("#R2cards").text(dealcards+" cards");
    $("#numhands").text(numrounds);

    // reset the option values
    $("#R2col1bid").find('option').remove();
    $("#R2col1won").find('option').remove();
    $("#R2col2bid").find('option').remove();
    $("#R2col2won").find('option').remove();
    $("#R2col3bid").find('option').remove();
    $("#R2col3won").find('option').remove();
    $("#R2col4bid").find('option').remove();
    $("#R2col4won").find('option').remove();

    if(dealcards == 6) {
        optionstring = '<option value="0">Nothing</option>';
        $("#R2col1bid").append(optionstring);
        $("#R2col2bid").append(optionstring);
        $("#R2col3bid").append(optionstring);
        $("#R2col4bid").append(optionstring);

        optionstring = '<option value="6">All (6)</option>';
        $("#R2col1bid").append(optionstring);
        $("#R2col2bid").append(optionstring);
        $("#R2col3bid").append(optionstring);
        $("#R2col4bid").append(optionstring);
    } // end if 6

    else if(dealcards == 12) {
        optionstring = '<option value="0">Nothing</option>';
        $("#R2col1bid").append(optionstring);
        $("#R2col2bid").append(optionstring);
        $("#R2col3bid").append(optionstring);
        $("#R2col4bid").append(optionstring);

        optionstring = '<option value="12">All (12)</option>';
        $("#R2col1bid").append(optionstring);
        $("#R2col2bid").append(optionstring);
        $("#R2col3bid").append(optionstring);
        $("#R2col4bid").append(optionstring);
    } // end else 12

    else {

        for ( i=0;i<=dealcards; i++) {
            optionstring = '<option value="'+i+'">'+i+'</option>';
            $("#R2col1bid").append(optionstring);
            $("#R2col2bid").append(optionstring);
            $("#R2col3bid").append(optionstring);
            $("#R2col4bid").append(optionstring);
        }

    } // end else - not 6 or 12

    for (i=0;i<=dealcards; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#R2col1won").append(optionstring);
        $("#R2col2won").append(optionstring);
        $("#R2col3won").append(optionstring);
        $("#R2col4won").append(optionstring);
    }

    //clear out the values
    $("#R2col1bid").val("0");
    $("#R2col1won").val("0");
    $("#R2col2bid").val("0");
    $("#R2col2won").val("0");
    $("#R2col3bid").val("0");
    $("#R2col3won").val("0");
    $("#R2col4bid").val("0");
    $("#R2col4won").val("0");

    // start populating the handbyhand table
    $('#R2handbyhand > tbody:last-child').append("<tr><td></td>"+newrow+"<tr>\n");

    $(".R2bidrow").eq(startplayer-1).focus();

    $("#R2score").click(function() {
        // start building the row for the handbyhand table
        newrowbid = "<th>Hand "+round+"</th><td>Bid:</td>";
        newrowwon = "<td></td><td>Won:</td>";
        newrowscore = "<td></td><td>Score:</td>";

        // first check to see if anyone bid "all" and made it
        var bidmadeall = 0;
        if((dealcards == 6) || (dealcards == 12)) {
            if(($("#R2col1bid").val() == dealcards) && ($("#R2col1won").val() == dealcards)) bidmadeall = 1;
            if(($("#R2col2bid").val() == dealcards) && ($("#R2col2won").val() == dealcards)) bidmadeall = 2;
            if(($("#R2col3bid").val() == dealcards) && ($("#R2col3won").val() == dealcards)) bidmadeall = 3;
            if(($("#R2col4bid").val() == dealcards) && ($("#R2col4won").val() == dealcards)) bidmadeall = 4;
        }

        //player 1 is always in the game - score him
        player1score = R2score(player1score,dealcards,$("#R2col1bid").val(),$("#R2col1won").val(),bidmadeall);
        $("#R2col1score").text(player1score);
        newrowbid = newrowbid + "<td>"+$("#R2col1bid").val()+"</td>";
        newrowwon = newrowwon + "<td>"+$("#R2col1won").val()+"</td>";
        newrowscore = newrowscore + "<td>"+player1score+"</td>";
        // For each round, start by resetting highest score, leader, and winner to be player 1
        highestscore = player1score;
        leader = player1name;
        winner = leader+" wins!";

        //player 2 is in the game if 3 or 4 players
        if((numplayers == 3) || (numplayers == 4)) {
            player2score = R2score(player2score,dealcards,$("#R2col2bid").val(),$("#R2col2won").val(),bidmadeall);
            $("#R2col2score").text(player2score);
            newrowbid = newrowbid + "<td>"+$("#R2col2bid").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#R2col2won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player2score+"</td>";
            if(player2score == highestscore) {
                leader = leader +" and "+player2name;
                winner = leader+" tie!";
            }
            else if(player2score > highestscore) {
                highestscore = player2score;
                leader = player2name;
                winner = leader+" wins!";
            }
        }

        //player 3 is in the game if 2 or 4 players
        if((numplayers == 2) || (numplayers == 4)) {
            player3score = R2score(player3score,dealcards,$("#R2col3bid").val(),$("#R2col3won").val(),bidmadeall);
            $("#R2col3score").text(player3score);
            newrowbid = newrowbid + "<td>"+$("#R2col3bid").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#R2col3won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player3score+"</td>";
            if(player3score == highestscore) {
                leader = leader +" and "+player3name;
                winner = leader+" tie!";
            }
            else if(player3score > highestscore) {
                highestscore = player3score;
                leader = player3name;
                winner = leader+" wins!";
            }
        }

        //player 4 is in the game if 3 or 4 players
        if((numplayers == 3) || (numplayers == 4)) {
            player4score = R2score(player4score,dealcards,$("#R2col4bid").val(),$("#R2col4won").val(),bidmadeall);
            $("#R2col4score").text(player4score);
            newrowbid = newrowbid + "<td>"+$("#R2col4bid").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#R2col4won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player4score+"</td>";
            if(player4score == highestscore) {
                leader = leader +" and "+player4name;
                winner = leader+" tie!";
            }
            else if(player4score > highestscore) {
                highestscore = player4score;
                leader = player4name;
                winner = leader+" wins!";
            }
        }

        $('#R2handbyhand > tbody:last-child').append("<tr>"+newrowbid+"<tr>\n");
        $('#R2handbyhand > tbody:last-child').append("<tr>"+newrowwon+"<tr>\n");
        $('#R2handbyhand > tbody:last-child').append("<tr>"+newrowscore+"<tr>\n");

        if(round == numrounds) {
            $("#R2roundline").text("");
            $("#R2dealerline").text("");
            $("#winner").text(winner);
            $("#gameover").show();
            $("#R2scoringinputs").hide();
        }
        else {
            round = round+1;
            dealcards = dealcards + dealincrement;
            if(dealcards == maxdeal) {
                dealincrement = 0 - dealincrement;
            }
            $("#R2handnum").text(round);
            $("#R2dealer").text(R2dealer(round,numplayers));
            $("#R2cards").text(dealcards+" cards");

            // reset the option values
            $("#R2col1bid").find('option').remove();
            $("#R2col1won").find('option').remove();
            $("#R2col2bid").find('option').remove();
            $("#R2col2won").find('option').remove();
            $("#R2col3bid").find('option').remove();
            $("#R2col3won").find('option').remove();
            $("#R2col4bid").find('option').remove();
            $("#R2col4won").find('option').remove();

            if(dealcards == 6) {
                optionstring = '<option value="0">Nothing</option>';
                $("#R2col1bid").append(optionstring);
                $("#R2col2bid").append(optionstring);
                $("#R2col3bid").append(optionstring);
                $("#R2col4bid").append(optionstring);

                optionstring = '<option value="6">All (6)</option>';
                $("#R2col1bid").append(optionstring);
                $("#R2col2bid").append(optionstring);
                $("#R2col3bid").append(optionstring);
                $("#R2col4bid").append(optionstring);
            } // end if 6

            else if(dealcards == 12) {
                optionstring = '<option value="0">Nothing</option>';
                $("#R2col1bid").append(optionstring);
                $("#R2col2bid").append(optionstring);
                $("#R2col3bid").append(optionstring);
                $("#R2col4bid").append(optionstring);

                optionstring = '<option value="12">All (12)</option>';
                $("#R2col1bid").append(optionstring);
                $("#R2col2bid").append(optionstring);
                $("#R2col3bid").append(optionstring);
                $("#R2col4bid").append(optionstring);
            } // end else 12

            else {

                for ( i=0;i<=dealcards; i++) {
                    optionstring = '<option value="'+i+'">'+i+'</option>';
                    $("#R2col1bid").append(optionstring);
                    $("#R2col2bid").append(optionstring);
                    $("#R2col3bid").append(optionstring);
                    $("#R2col4bid").append(optionstring);
                }

            } // end else - not 6 or 12

            for (i=0;i<=dealcards; i++) {
                optionstring = '<option value="'+i+'">'+i+'</option>';
                $("#R2col1won").append(optionstring);
                $("#R2col2won").append(optionstring);
                $("#R2col3won").append(optionstring);
                $("#R2col4won").append(optionstring);
            }

            //clear out the values
            $("#R2col1bid").val("0");
            $("#R2col1won").val("0");
            $("#R2col2bid").val("0");
            $("#R2col2won").val("0");
            $("#R2col3bid").val("0");
            $("#R2col3won").val("0");
            $("#R2col4bid").val("0");
            $("#R2col4won").val("0");
            $("#R2totalwon").text("0");
            $("#R2totalbid").text("0");

            startplayer = R2nextplayer(startplayer,numplayers);
            $(".R2bidrow").eq(startplayer-1).focus();

        }
    });

    $(".R2wonrow").change(function() {
        winsum = Number($("#R2col1won").val()) + Number($("#R2col2won").val()) + Number($("#R2col3won").val()) + Number($("#R2col4won").val());
        $("#R2totalwon").text(winsum);
    });

    $(".R2bidrow").change(function() {
        winsum = Number($("#R2col1bid").val()) + Number($("#R2col2bid").val()) + Number($("#R2col3bid").val()) + Number($("#R2col4bid").val());
        $("#R2totalbid").text(winsum);
    });

}



function R2score(previous,hand,bid,won,bidmadeall) {
    // score differently for hands of 6 or 12
    if((hand == 6) || (hand == 12)) {
        // first check to see if this player bid all
        if(bid == hand) { // bid all
            if(won == hand) { // won all
                return Number(previous) + 2*Number(hand);
            }
            else { // didn't win all
                return Number(previous);
            }
        } // end if bid all
        else { // didn't bid all
            if(bidmadeall > 0) { // someone bid and made all
                return Number(previous);
            }
            else {
                return Number(previous) + 2*Number(hand) - 2*Number(won);
            }
        } // end else - didn't bid all
    } // end if hand of 6 or 12
    else {
        if(bid == won) {
            return Number(previous) + Number(bid)+2;
        }
        else {
            return Number(previous);
        }
    } // end else hand not 6 or 12
}

function R2dealer(hand,players) {
  if(players == 2) {
    if((hand % 2) == 0) {
      return player3name;
    }
    else {
      return player1name;
    }
  }
  if(players == 3) {
    if((hand % 3) == 0) {
      return player4name;
    }
    else if((hand % 3) == 1) {
      return player1name;
    }
    else {
      return player2name;
    }
  }
  else {
    if((hand % 4) == 0) {
      return player4name;
    }
    else if((hand % 4) == 1) {
      return player1name;
    }
    else if((hand % 4) == 2) {
      return player2name;
    }
    else {
      return player3name;
    }
  }
}
function R2nextplayer(player,players) {
  if(players == 2) {
    if(player == 1) {
      return 3;
    }
    else {
      return 1;
    }
  }
  if(players == 3) {
    if(player == 1) {
      return 2;
    }
    else if(player == 2) {
      return 4;
    }
    else {
      return 1;
    }
  }
  else {
    if(player == 1) {
      return 2;
    }
    else if(player == 2) {
      return 3;
    }
    else if(player == 3) {
      return 4;
    }
    else {
      return 1;
    }
  }
}
