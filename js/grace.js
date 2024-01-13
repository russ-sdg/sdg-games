function graceNamesDone() {
    numtricks = 48/numplayers;
    midpoint = numtricks/2;

    $("#gracecol1bid").find('option').remove();
    //$("#gracecol1bid").append('<option value="0" selected)> </option>');
    for (var i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol1bid").append(optionstring);
    }

    $("#gracecol2bid").find('option').remove();
    //$("#gracecol2bid").append('<option value="0" selected)> </option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol2bid").append(optionstring);
    }

    $("#gracecol3bid").find('option').remove();
    //$("#gracecol3bid").append('<option value="0" selected)> </option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol3bid").append(optionstring);
    }

    $("#gracecol4bid").find('option').remove();
    //$("#gracecol4bid").append('<option value="0" selected)> </option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol4bid").append(optionstring);
    }

    $("#gracecol1won").find('option').remove();
    $("#gracecol1won").append('<option value="0" selected)>0</option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol1won").append(optionstring);
    }

    $("#gracecol2won").find('option').remove();
    $("#gracecol2won").append('<option value="0" selected)>0</option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol2won").append(optionstring);
    }

    $("#gracecol3won").find('option').remove();
    $("#gracecol3won").append('<option value="0" selected)>0</option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol3won").append(optionstring);
    }

    $("#gracecol4won").find('option').remove();
    $("#gracecol4won").append('<option value="0" selected)>0</option>');
    for (i=1;i<=numtricks; i++) {
        optionstring = '<option value="'+i+'">'+i+'</option>';
        $("#gracecol4won").append(optionstring);
    }

    $("#selectedGame").text("Grace");
    $("#select-game").hide();
    $("#selectedGame").show();
    $("#playingToLine").show();

    $("#R2scorepad").hide();
    $("#R1scorepad").hide();
    $("#gracescorepad").show();
    $("#mercyscorepad").hide();

    $("#gracecol1name").text(player1name);
    $("#gracecol2name").text(player2name);
    $("#gracecol3name").text(player3name);
    $("#gracecol4name").text(player4name);

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
    startplayer = gracenextplayer(1,numplayers);


    $(".gracebidrow").eq(startplayer-1).focus();

    // start populating the handbyhand table
    $('#gracehandbyhand > tbody:last-child').append("<tr><td></td>"+newrow+"<tr>\n");

    $("#gracescore").click(function() {
        // start building the row for the handbyhand table
        newrowbid = "<th>Hand "+round+"</th><td>Bid:</td>";
        newrowwon = "<td></td><td>Won:</td>";
        newrowscore = "<td></td><td>Score:</td>";

        //player 1 is always in the game - score him
        player1score = gracescore(player1score,round,$("#gracecol1bid").val(),$("#gracecol1won").val());
        $("#gracecol1score").text(player1score);
        newrowbid = newrowbid + "<td>"+$("#gracecol1bid").val()+"</td>";
        newrowwon = newrowwon + "<td>"+$("#gracecol1won").val()+"</td>";
        newrowscore = newrowscore + "<td>"+player1score+"</td>";
        // For each round, start by resetting highest score, leader, and winner to be player 1
        highestscore = player1score;
        leader = player1name;
        winner = leader+" wins";

        //player 2 is in the game if 3 or 4 players
        if((numplayers == 3) || (numplayers == 4)) {
            player2score = gracescore(player2score,round,$("#gracecol2bid").val(),$("#gracecol2won").val());
            $("#gracecol2score").text(player2score);
            newrowbid = newrowbid + "<td>"+$("#gracecol2bid").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#gracecol2won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player2score+"</td>";
            if(player2score == highestscore) {
                leader = leader +" and "+player2name;
                winner = leader+" tie";
            }
            else if(player2score > highestscore) {
                highestscore = player2score;
                leader = player2name;
                winner = leader+" wins";
            }
        }

        //player 3 is in the game if 2 or 4 players
        if((numplayers == 2) || (numplayers == 4)) {
            player3score = gracescore(player3score,round,$("#gracecol3bid").val(),$("#gracecol3won").val());
            $("#gracecol3score").text(player3score);
            newrowbid = newrowbid + "<td>"+$("#gracecol3bid").val()+"</td>";
            newrowwon = newrowwon + "<td>"+$("#gracecol3won").val()+"</td>";
            newrowscore = newrowscore + "<td>"+player3score+"</td>";
            if(player3score == highestscore) {
                leader = leader +" and "+player3name;
                winner = leader+" tie";
            }
            else if(player3score > highestscore) {
                highestscore = player3score;
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
            if(player4score == highestscore) {
                leader = leader +" and "+player4name;
                winner = leader+" tie";
            }
            else if(player4score > highestscore) {
                highestscore = player4score;
                leader = player4name;
                winner = leader+" wins";
            }
        }

        $('#gracehandbyhand > tbody:last-child').append("<tr>"+newrowbid+"<tr>\n");
        $('#gracehandbyhand > tbody:last-child').append("<tr>"+newrowwon+"<tr>\n");
        $('#gracehandbyhand > tbody:last-child').append("<tr>"+newrowscore+"<tr>\n");


        //clear out the values
        $("#gracecol1bid").val(0);
        $("#gracecol1won").val(0);
        $("#gracecol2bid").val(0);
        $("#gracecol2won").val(0);
        $("#gracecol3bid").val(0);
        $("#gracecol3won").val(0);
        $("#gracecol4bid").val(0);
        $("#gracecol4won").val(0);

        if(Number(highestscore) > Number(endingscore)) {
            $("#graceroundline").text("");
            $("#gracedealerline").text("");
            $("#gracescoringinputs").hide();
            $("#winner").text(winner);
            $("#gameover").show();
        }
        else {
            round = round+1;
            $("#gracedealer").text(gracedealer(round,numplayers));
            $("#gracecards").text(round+" cards");
                startplayer = gracenextplayer(startplayer,numplayers);
        $(".gracebidrow").eq(startplayer-1).focus();
        }
    });

    $(".gracewonrow").change(function() {
        //update the total
        winsum = Number($("#gracecol1won").val())+Number($("#gracecol2won").val())+Number($("#gracecol3won").val())+Number($("#gracecol4won").val());
        $("#gracetotalwon").text(winsum);
    });

    $(".gracebidrow").change(function() {
        //update the total
        bidsum = Number($("#gracecol1bid").val())+Number($("#gracecol2bid").val())+Number($("#gracecol3bid").val())+Number($("#gracecol4bid").val());
        $("#gracetotalbid").text(bidsum);
    });

}



function gracescore(previous,hand,bid,won) {
    if(Number(bid) > Number(won)) {
        return Number(previous);
    }
    else {
        return Number(previous)+10*Number(bid)+Number(won)-Number(bid);
    }
}

function gracedealer(hand,players) {
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
function gracenextplayer(player,players) {
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
