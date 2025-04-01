function r2NamesDone() {
    var i = 0;
    $("#R2scorepad").show();

    $("#R2col1name").text(player1name);
    $("#R2col2name").text(player2name);
    $("#R2col3name").text(player3name);
    $("#R2col4name").text(player4name);
    $("#R2col5name").text(player5name);
    $("#R2col6name").text(player6name);

    newrow = "<th>Players:</th><th>"+player1name+"</th>";

    if(numplayers == 2) {
        $(".col2").show();
        $(".col3").hide();
        $(".col4").hide();
        $(".col5").hide();
        $(".col6").hide();
        newrow = newrow+"<th>"+player2name+"</th>";
    }

    if(numplayers == 3) {
        $(".col2").show();
        $(".col3").show();
        $(".col4").hide();
        $(".col5").hide();
        $(".col6").hide();
        newrow = newrow+"<th>"+player2name+"</th><th>"+player3name+"</th>";
    }

    if(numplayers == 4) {
        $(".col2").show();
        $(".col3").show();
        $(".col4").show();
        $(".col5").hide();
        $(".col6").hide();
        newrow = newrow+"<th>"+player2name+"</th><th>"+player3name+"</th><th>"+player4name+"</th>";
    }

    if(numplayers == 5) {
        $(".col2").show();
        $(".col3").show();
        $(".col4").show();
        $(".col5").show();
        $(".col6").hide();
        newrow = newrow+"<th>"+player2name+"</th><th>"+player3name+"</th><th>"+player4name+"</th><th>"+player5name+"</th>";
    }

    if(numplayers == 6) {
        $(".col2").show();
        $(".col3").show();
        $(".col4").show();
        $(".col5").show();
        $(".col6").show();
        newrow = newrow+"<th>"+player2name+"</th><th>"+player3name+"</th><th>"+player4name+"</th><th>"+player5name+"</th><th>"+player6name+"</th>";
    }

    $("#R2score").click(function() {
        // start building the row for the handbyhand table
        oldrowscore = "<td></td>";
        newrowscore = "<td></td><th>Score:</th>";


        // loop through players up to numplayers adding this round score to their current score


        // player 1
        oldrowscore = oldrowscore + "<td style='text-align: center;'>" + player1score + "</td>";
        player1score = Number(player1score) + Number($("#score1").val());
        $("#R2col1score").text(player1score);

        // player 2
        oldrowscore = oldrowscore + "<td style='text-align: center;'>" + player2score + "</td>";
        player2score = Number(player2score) + Number($("#score2").val());
        $("#R2col2score").text(player2score);


        if(numplayers > 2) {

            // player 3
            oldrowscore = oldrowscore + "<td style='text-align: center;'>" + player3score + "</td>";
            player3score = Number(player3score) + Number($("#score3").val());
            $("#R2col3score").text(player3score);

            if(numplayers > 3) {
                // player 4
                oldrowscore = oldrowscore + "<td style='text-align: center;'>" + player4score + "</td>";
                player4score = Number(player4score) + Number($("#score4").val());
                $("#R2col4score").text(player4score);

                if(numplayers > 4) {
                    // player 5
                    oldrowscore = oldrowscore + "<td style='text-align: center;'>" + player5score + "</td>";
                    player5score = Number(player5score) + Number($("#score5").val());
                    $("#R2col5score").text(player5score);

                    if(numplayers > 5) {
                        // player 6
                        oldrowscore = oldrowscore + "<td style='text-align: center;'>" + player6score + "</td>";
                        player6score = Number(player6score) + Number($("#score6").val());
                        $("#R2col6score").text(player6score);
                    }
                }
            }
        }
        $('#R2scoretr').before("<tr>"+oldrowscore+"<tr>\n");

            //clear out the values
            $("#score1").val("0");
            $("#score2").val("0");
            $("#score3").val("0");
            $("#score4").val("0");
            $("#score5").val("0");
            $("#score6").val("0");

            $(".R2wonrow").eq(0).focus();

    });


}
