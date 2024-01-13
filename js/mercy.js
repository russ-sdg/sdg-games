function mercyNamesDone() {
    numtricks = 48/numplayers;
    midpoint = numtricks/2;

    $("#mercygracecol1won").find('option').remove();
    //$("#mercygracecol1won").append('<option value="0" selected)> </option>');
    for (var i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercygracecol1won").append(optionstring);
    }

    $("#mercygracecol2won").find('option').remove();
    //$("#mercygracecol2won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercygracecol2won").append(optionstring);
    }

    $("#mercygracecol3won").find('option').remove();
    //$("#mercygracecol3won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercygracecol3won").append(optionstring);
    }

    $("#mercygracecol4won").find('option').remove();
    //$("#mercygracecol4won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercygracecol4won").append(optionstring);
    }

    $("#mercyspecialcol1won").find('option').remove();
    //$("#mercyspecialcol1won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercyspecialcol1won").append(optionstring);
    }

    $("#mercyspecialcol2won").find('option').remove();
    //$("#mercyspecialcol2won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercyspecialcol2won").append(optionstring);
    }

    $("#mercyspecialcol3won").find('option').remove();
    //$("#mercyspecialcol3won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercyspecialcol3won").append(optionstring);
    }

    $("#mercyspecialcol4won").find('option').remove();
    //$("#mercyspecialcol4won").append('<option value="0" selected)> </option>');
    for (i=0;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#mercyspecialcol4won").append(optionstring);
    }

    $("#selectedGame").text("Mercy");
    $("#select-game").hide();
    $("#selectedGame").show();
    $("#playingToLine").show();

    $("#R2scorepad").hide();
    $("#R1scorepad").hide();
    $("#gracescorepad").hide();
    $("#mercyscorepad").show();

    $("#mercycol1name").text(player1name);
    $("#mercycol2name").text(player2name);
    $("#mercycol3name").text(player3name);
    $("#mercycol4name").text(player4name);

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
    startplayer = mercynextplayer(1,numplayers);


    $(".mercygracewonrow").eq(startplayer-1).focus();

    // start populating the handbyhand table
    $('#mercyhandbyhand > tbody:last-child').append("<tr><td></td>"+newrow+"<tr>\n");

    $("#mercyscore").click(function() {
        // start building the row for the handbyhand table
        newrowbid = "<th>Hand "+round+"</th><td>Grace Cards:</td>";
        newrowwon = "<td></td><td>Special Cards:</td>";
        newrowscore = "<td></td><td>Score:</td>";

        //player 1 is always in the game - score him
        player1score = mercyscore(player1score,round,$("#mercygracecol1won").val(),$("#mercyspecialcol1won").val());
        $("#mercycol1score").text(player1score);
        newrowbid = newrowbid + "<td>"+$("#mercygracecol1won").val()+"</td>";
        newrowwon = newrowwon + "<td>"+$("#mercyspecialcol1won").val()+"</td>";
        newrowscore = newrowscore + "<td>"+player1score+"</td>";
        // For each round, start by resetting highest score, lowest score, leader, and winner to be player 1
        highestscore = player1score;
        lowestscore = player1score;
        leader = player1name;
        winner = leader+" wins";

        //player 2 is in the game if 3 or 4 players
        if((numplayers == 3) || (numplayers == 4)) {
            player2score = mercyscore(player2score,round,$("#mercygracecol2won").val(),$("#mercyspecialcol2won").val());
            $("#mercycol2score").text(player2score);
            newrowbid = newrowbid + "<td>"+$("#mercygracecol2won").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#mercyspecialcol2won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player2score+"</td>";
            if(player2score > highestscore) {
                highestscore = player2score;
            }
            if(player2score == lowestscore) {
                leader = leader +" and "+player2name;
                winner = leader+" tie";
            }
            else if(player2score < lowestscore) {
                lowestscore = player2score;
                leader = player2name;
                winner = leader+" wins";
            }
        }

        //player 3 is in the game if 2 or 4 players
        if((numplayers == 2) || (numplayers == 4)) {
            player3score = mercyscore(player3score,round,$("#mercygracecol3won").val(),$("#mercyspecialcol3won").val());
            $("#mercycol3score").text(player3score);
            newrowbid = newrowbid + "<td>"+$("#mercygracecol3won").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#mercyspecialcol3won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player3score+"</td>";
            if(player3score > highestscore) {
                highestscore = player3score;
            }
            if(player3score == lowestscore) {
                leader = leader +" and "+player3name;
                winner = leader+" tie";
            }
            else if(player3score < lowestscore) {
                lowestscore = player3score;
                leader = player3name;
                winner = leader+" wins";
            }
        }

        //player 4 is in the game if 3 or 4 players
        if((numplayers == 3) || (numplayers == 4)) {
            player4score = gracescore(player4score,round,$("#gracecol4bid").val(),$("#gracecol4won").val());
            $("#gracecol4score").text(player4score);
            newrowbid = newrowbid + "<td>"+$("#gracecol4bid").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#gracecol4won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player4score+"</td>";
            if(player4score > highestscore) {
                highestscore = player4score;
            }
            if(player4score == lowestscore) {
                leader = leader +" and "+player4name;
                winner = leader+" tie";
            }
            else if(player4score < lowestscore) {
                lowestscore = player4score;
                leader = player4name;
                winner = leader+" wins";
            }
        }

        $('#mercyhandbyhand > tbody:last-child').append("<tr>"+newrowbid+"<tr>\n");
        $('#mercyhandbyhand > tbody:last-child').append("<tr>"+newrowwon+"<tr>\n");
        $('#mercyhandbyhand > tbody:last-child').append("<tr>"+newrowscore+"<tr>\n");


        //clear out the values
        $("#mercygracecol1won").val(0);
        $("#mercyspecialcol1won").val(0);
        $("#mercygracecol2won").val(0);
        $("#mercyspecialcol2won").val(0);
        $("#mercygracecol3won").val(0);
        $("#mercyspecialcol3won").val(0);
        $("#mercygracecol4won").val(0);
        $("#mercyspecialcol4won").val(0);

        if(Number(highestscore) > Number(endingscore)) {
            $("#mercyroundline").hide();
            $("#mercydealerline").hide();
            $("#mercyscoringinputs").hide();
            $("#winner").text(winner);
            $("#gameover").show();
        }
        else {
            round = round+1;
            $("#mercydealer").text(mercydealer(round,numplayers));
            $("#mercycards").text(round+" cards");
            startplayer = mercynextplayer(startplayer,numplayers);
        $(".mercybidrow").eq(startplayer-1).focus();
        }
    });

    $(".mercygracewonrow").change(function() {
        //update the total
        winsum = Number($("#mercygracecol1won").val())+Number($("#mercygracecol2won").val())+Number($("#mercygracecol3won").val())+Number($("#mercygracecol4won").val());
        $("#mercygracetotalwon").text(winsum);
    });

    $(".mercyspecialwonrow").change(function() {
        //update the total
        winsum = Number($("#mercyspecialcol1won").val())+Number($("#mercyspecialcol2won").val())+Number($("#mercyspecialcol3won").val())+Number($("#mercyspecialcol4won").val());
        $("#mercyspecialtotalwon").text(winsum);
    });


}



function mercyscore(previous,hand,grace,special) {
    return Number(previous)+Number(grace)+7*Number(special);
}

function mercydealer(hand,players) {
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
function mercynextplayer(player,players) {
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
