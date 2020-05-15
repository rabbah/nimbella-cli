/*
 * Nimbella CONFIDENTIAL
 * ---------------------
 *
 *   2018 - present Nimbella Corp
 *   All Rights Reserved.
 *
 * NOTICE:
 *
 * All information contained herein is, and remains the property of
 * Nimbella Corp and its suppliers, if any.  The intellectual and technical
 * concepts contained herein are proprietary to Nimbella Corp and its
 * suppliers and may be covered by U.S. and Foreign Patents, patents
 * in process, and are protected by trade secret or copyright law.
 *
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Nimbella Corp.
 */


//
//  Samples
//  TODO: these should be in common between here, the playground, and the cloud editor.
//  As it stands
//    - the playground has its own table although its samples are (mostly) textually the same as these
//    - the cloud editor has its own table (in placeholders.ts).  It samples are similar to a subset of these
//      (lacking java, go, and typescript)
//

const js = `function main(args) {
    let name = args.name || 'stranger'
    let greeting = 'Hello ' + name + '!'
    console.log(greeting)
    return {"body": greeting}
  }
  `

  const ts = `export function main(args: {}): {} {
    let name: string = args['name'] || 'stranger'
    let greeting: string = 'Hello ' + name + '!'
    console.log(greeting)
    return { body: greeting }
  }
  `

  const py = `def main(args):
      name = args.get("name", "stranger")
      greeting = "Hello " + name + "!"
      print(greeting)
      return {"body": greeting}
  `

  const swift = `func main(args: [String:Any]) -> [String:Any] {
      if let name = args["name"] as? String {
          let greeting = "Hello \(name)!"
          print(greeting)
          return [ "greeting" : greeting ]
      } else {
          let greeting = "Hello stranger!"
          print(greeting)
          return [ "body" : greeting ]
      }
  }
  `

  const php = `<?php
  function main(array $args) : array
  {
      $name = $args["name"] ?? "stranger";
      $greeting = "Hello $name!";
      echo $greeting;
      return ["body" => $greeting];
  }
  `

  const java = `import com.google.gson.JsonObject;

  public class Main {
      public static JsonObject main(JsonObject args) {
          String name = "stranger";
          if (args.has("name"))
              name = args.getAsJsonPrimitive("name").getAsString();
          String greeting = "Hello " + name + "!";
          JsonObject response = new JsonObject();
          response.addProperty("body", greeting);
          return response;
      }
  }
  `

  const go = `package main

  func Main(args map[string]interface{}) map[string]interface{} {
    name, ok := args["name"].(string)
    if !ok {
      name = "stranger"
    }
    msg := make(map[string]interface{})
    msg["body"] = "Hello, " + name + "!"
    return msg
  }
  `
export const samples = { js, py, php, swift, java, go, ts }
