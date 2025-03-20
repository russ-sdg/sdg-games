/*!
* Start Bootstrap - Small Business v5.0.6 (https://startbootstrap.com/template/small-business)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-small-business/blob/master/LICENSE)
*/
// This file is intentionally blank
// Use this file to add JavaScript to your project

const currentYear = new Date().getFullYear();

$( document ).ready(function() {
    console.log( "ready!" );
    $(".current-year").text(currentYear);
    $("#main-nav").load("https://sdggames.fun/nav-div.html", function() {
        console.log( "Nav load was performed." );
      });
});
