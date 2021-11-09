import webex from 'webextension-polyfill'

var list = document.getElementById('shortcut-list');

window.onload = async () => {
  list ? list.innerHTML = "" : null;
  const commands = await webex.commands.getAll()
  var inner = commands.filter(command => {
    return command.description != "";
  }).map(function (command) {
    var shortcut;
    if (command.shortcut == "") {
      shortcut = "<i>None</i>";
    } else {
      shortcut = command.shortcut;
    }
    return "<tr><td>" + command.description + "</td><td>" + shortcut + "</td></tr>";
  }).join("");

  list ? list.innerHTML = inner : null;
}
